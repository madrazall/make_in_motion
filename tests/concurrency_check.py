"""
The test the whole build hangs on.

Fire N simultaneous reserve_seats() calls at an event with a known capacity and
assert that the number of seats actually committed is EXACTLY the capacity.
Never more. If this fails, people show up to a brewery with no chair.

Run scenarios:
  1. 20 buyers x 1 seat  -> 10 capacity  => exactly 10 sold, 10 rejected
  2. 20 buyers x 3 seats -> 10 capacity  => never exceeds 10 (partial fills)
  3. holds block, then expire and free the seats
  4. the oversell trigger actually fires on a hand-inserted bad row
"""
import concurrent.futures as cf
import sys
import psycopg
import pgserver

db = pgserver.get_server("/tmp/pgdata")
URI = db.get_uri()

FAILURES = []


def check(label, condition, detail=""):
    status = "PASS" if condition else "FAIL"
    print(f"  [{status}] {label}" + (f" — {detail}" if detail else ""))
    if not condition:
        FAILURES.append(label)


def reset(capacity, seats_per_order):
    with psycopg.connect(URI, autocommit=True) as conn:
        conn.execute("delete from orders")
        conn.execute("delete from events")
        conn.execute("delete from venues")
        vid = conn.execute(
            "insert into venues (name, address, city, zip) "
            "values ('Test Brewery','1 Main St','Middletown','06457') returning id"
        ).fetchone()[0]
        eid = conn.execute(
            """insert into events
               (slug, title, venue_id, starts_at, ends_at, capacity, min_to_run, price_cents, status)
               values ('t','T',%s, now() + interval '10 days', now() + interval '10 days 2 hours',
                       %s, %s, 4500, 'published')
               returning id""",
            (vid, capacity, min(6, capacity)),
        ).fetchone()[0]
    return eid


def buy(event_id, seats, i):
    """One independent connection = one independent buyer."""
    try:
        with psycopg.connect(URI, autocommit=True) as conn:
            row = conn.execute(
                "select reserve_seats(%s,%s,%s,%s,%s,%s)",
                (event_id, seats, f"Buyer {i}", f"b{i}@example.com", None, "1.0"),
            ).fetchone()[0]
            return row
    except Exception as e:
        return {"ok": False, "reason": f"exception: {e}"}


def committed(event_id):
    with psycopg.connect(URI, autocommit=True) as conn:
        return conn.execute("select seats_taken(%s)", (event_id,)).fetchone()[0]


def run(label, capacity, buyers, seats_each):
    print(f"\n{label}")
    eid = reset(capacity, seats_each)
    with cf.ThreadPoolExecutor(max_workers=buyers) as pool:
        results = list(pool.map(lambda i: buy(eid, seats_each, i), range(buyers)))

    ok = [r for r in results if r.get("ok")]
    rejected = [r for r in results if not r.get("ok")]
    total = committed(eid)

    print(f"  {len(ok)} succeeded, {len(rejected)} rejected, {total} seats committed "
          f"of {capacity} capacity")

    check("never oversold", total <= capacity, f"{total} <= {capacity}")
    check("no seat left on the table",
          total > capacity - seats_each,
          f"{total} seats sold, order size {seats_each}")
    check("successes match committed seats", len(ok) * seats_each == total)
    bad = [r for r in rejected if r.get("reason", "").startswith("exception")]
    check("no unhandled exceptions", not bad, str(bad[:2]) if bad else "")
    return total


print("=" * 62)
print("CONCURRENCY: reserve_seats() under simultaneous load")
print("=" * 62)

run("Scenario 1 — 20 buyers race for 10 single seats", 10, 20, 1)
run("Scenario 2 — 20 buyers each want 3 seats, capacity 10", 10, 20, 3)
run("Scenario 3 — 40 buyers, 2 seats each, capacity 18", 18, 40, 2)

# ---------------------------------------------------------------- holds expire
print("\nScenario 4 — unpaid holds block, then expire and free the seats")
eid = reset(4, 1)
for i in range(4):
    buy(eid, 1, i)
check("holds fill the room", committed(eid) == 4, f"{committed(eid)} of 4")
blocked = buy(eid, 1, 99)
check("5th buyer is refused while holds are live",
      not blocked.get("ok") and blocked.get("reason") == "sold_out", str(blocked))

with psycopg.connect(URI, autocommit=True) as conn:
    conn.execute("update orders set hold_expires_at = now() - interval '1 minute'")
    freed = conn.execute("select expire_holds()").fetchone()[0]
check("expire_holds() releases them", freed == 4, f"released {freed}")
check("room is empty again", committed(eid) == 0, f"{committed(eid)} committed")
after = buy(eid, 1, 100)
check("seats are resellable", after.get("ok") is True, str(after))

# ------------------------------------------------------- paid seats stay taken
print("\nScenario 5 — a paid seat is not released by the sweep")
eid = reset(2, 1)
r = buy(eid, 1, 1)
with psycopg.connect(URI, autocommit=True) as conn:
    conn.execute(
        "update orders set status='paid', paid_at=now(), hold_expires_at=null where id=%s",
        (r["order_id"],),
    )
    conn.execute("select expire_holds()")
check("paid seat survives the sweep", committed(eid) == 1, f"{committed(eid)} committed")

print("\nScenario 6 — a no-show / late canceller keeps occupying the seat")
with psycopg.connect(URI, autocommit=True) as conn:
    conn.execute("update orders set status='partially_refunded' where id=%s", (r["order_id"],))
check("partially refunded seat still counted", committed(eid) == 1, f"{committed(eid)}")
with psycopg.connect(URI, autocommit=True) as conn:
    conn.execute("update orders set status='refunded' where id=%s", (r["order_id"],))
check("fully refunded seat goes back on sale", committed(eid) == 0, f"{committed(eid)}")

# ------------------------------------------------------------- trigger guard
print("\nScenario 7 — the oversell trigger fires on a hand-written bad row")
eid = reset(2, 1)
fired = False
msg = ""
try:
    with psycopg.connect(URI, autocommit=True) as conn:
        conn.execute(
            """insert into orders (confirmation_code, event_id, customer_name, email,
                                   seats, amount_cents, status)
               values ('MIM-BADBAD', %s, 'Sneaky Admin', 'x@example.com', 8, 36000, 'paid')""",
            (eid,),
        )
except psycopg.errors.RaiseException as e:
    fired = True
    msg = str(e).split("\n")[0]
except Exception as e:
    fired = "OVERSOLD" in str(e)
    msg = str(e).split("\n")[0]
check("trigger blocks the insert", fired, msg[:90])
check("nothing was committed", committed(eid) == 0, f"{committed(eid)}")

# ----------------------------------------------------------- validation rules
print("\nScenario 8 — input and state validation")
eid = reset(10, 1)
check("rejects 0 seats", buy(eid, 0, 1).get("reason") == "invalid_quantity")
check("rejects 9 seats (max is 8)", buy(eid, 9, 1).get("reason") == "invalid_quantity")
with psycopg.connect(URI, autocommit=True) as conn:
    conn.execute("update events set status='draft' where id=%s", (eid,))
check("draft events are not on sale", buy(eid, 1, 1).get("reason") == "event_not_on_sale")
with psycopg.connect(URI, autocommit=True) as conn:
    conn.execute(
        "update events set status='published', starts_at=now() - interval '1 hour',"
        " ends_at=now() + interval '1 hour' where id=%s",
        (eid,),
    )
check("past events are not on sale", buy(eid, 1, 1).get("reason") == "event_started")

print("\n" + "=" * 62)
if FAILURES:
    print(f"FAILED — {len(FAILURES)} check(s): {FAILURES}")
    sys.exit(1)
print("ALL CHECKS PASSED")
print("=" * 62)

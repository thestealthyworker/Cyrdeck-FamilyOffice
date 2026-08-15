# Sanity-check that the fixture numbers produce a genuine liquidity gap
# and a genuine hidden-concentration finding. If they don't, the demo is dead.

# ---- Look-through concentration -------------------------------------------
meridian_nav, kestrel_nav = 9_420_000, 3_060_000
re_equity = 8_250_000 - 4_000_000          # appraised value less mortgage
debt_book = 3_200_000+1_750_000+4_500_000+2_000_000
liquid    = 4_200_000
total_nav = meridian_nav + kestrel_nav + re_equity + debt_book + liquid
print(f"Total portfolio NAV (naive sum):      ${total_nav:,.0f}")

# Vertexa: 20% of Meridian NAV + 20% of Kestrel NAV
vertexa = 0.20*meridian_nav + 0.20*kestrel_nav
print(f"\nVertexa Software look-through:        ${vertexa:,.0f}  ({vertexa/total_nav:.1%} of portfolio)")
print(f"  - via Meridian IV:                  ${0.20*meridian_nav:,.0f}")
print(f"  - via Kestrel III:                  ${0.20*kestrel_nav:,.0f}")

# Aurex: equity via Kestrel + unsecured debt via Blackfin
aurex_eq, aurex_debt = 0.15*kestrel_nav, 2_000_000
print(f"\nAurex Data Centers total exposure:    ${aurex_eq+aurex_debt:,.0f}  ({(aurex_eq+aurex_debt)/total_nav:.1%})")
print(f"  - equity via Kestrel III:           ${aurex_eq:,.0f}")
print(f"  - UNSECURED debt via Blackfin:      ${aurex_debt:,.0f}")

# ---- Liquidity collision ---------------------------------------------------
unfunded = 2_150_000 + 3_500_000
print(f"\n--- LIQUIDITY COLLISION ---")
print(f"Total unfunded commitments:           ${unfunded:,.0f}")
print(f"Liquid book (today):                  ${liquid:,.0f}")
print(f"Base-case coverage ratio:             {liquid/unfunded:.2f}x")

# Stress: equities -30%, IG bonds -5%, cash flat; calls accelerate to 65% of
# undrawn within 12mo (GPs deploy into dislocation); distributions -> 0.
stressed = 850_000 + (1_950_000+720_000)*0.70 + 680_000*0.95
calls_12m = unfunded*0.65
print(f"\nStress (equity -30%, IG -5%):")
print(f"  Liquid book:                        ${stressed:,.0f}")
print(f"  Calls due within 12mo (65%):        ${calls_12m:,.0f}")
gap = stressed - calls_12m
print(f"  Coverage ratio:                     {stressed/calls_12m:.2f}x")
print(f"  {'SHORTFALL' if gap<0 else 'Surplus'}:{' '*27}${abs(gap):,.0f}")
print(f"\n  At risk if default on call: forfeiture of up to 100% of LP interest")
print(f"  = ${meridian_nav+kestrel_nav:,.0f} of reported NAV")

# ---- As-of date incoherence ------------------------------------------------
print(f"\n--- AS-OF DATE SPREAD ---")
for n,dt in [("Kestrel III","2026-03-31"),("Harbor View","2026-05-15"),
             ("Meridian IV","2026-06-30"),("Blackfin","2026-06-30"),
             ("Ashworth liquid","2026-07-31")]:
    print(f"  {n:<18} {dt}")
print("  -> naive total is a number that never existed at any single moment")

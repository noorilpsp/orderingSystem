import assert from "node:assert/strict";
import {
  applyCatalogPromo,
  applyPromosToBuiltLines,
  assignBogoPaidQuantities,
  bogoPaidQuantity,
  guestLineCompareAtTotal,
  lineTotalWithPromo,
} from "../src/lib/promotions/pricing";
import { isPromotionScheduleActive } from "../src/lib/promotions/schedule";

function testSalePrice() {
  const applied = applyCatalogPromo(10, {
    promotionId: "p1",
    kind: "sale_price",
    salePrice: 8,
  });
  assert.equal(applied?.price, 8);
  assert.equal(applied?.compareAtPrice, 10);
  assert.equal(
    applyCatalogPromo(10, {
      promotionId: "p1",
      kind: "sale_price",
      salePrice: 10,
    }),
    null,
  );
}

function testBogoPaidQty() {
  assert.equal(bogoPaidQuantity(1), 1);
  assert.equal(bogoPaidQuantity(2), 1);
  assert.equal(bogoPaidQuantity(3), 2);
  assert.equal(bogoPaidQuantity(4), 2);
}

function testLineTotals() {
  assert.equal(
    lineTotalWithPromo({
      kind: "sale_price",
      unitBasePrice: 8,
      customizationsTotal: 2,
      quantity: 2,
    }),
    18,
  );
  assert.equal(
    lineTotalWithPromo({
      kind: "bogo",
      unitBasePrice: 10,
      addOnsTotalPerUnit: 1,
      quantity: 2,
    }),
    12,
  );
}

function testAssignBogoAcrossLines() {
  const paid = assignBogoPaidQuantities([
    { id: "a", quantity: 1 },
    { id: "b", quantity: 1 },
    { id: "c", quantity: 1 },
  ]);
  assert.equal(paid.get("a"), 1);
  assert.equal(paid.get("b"), 0);
  assert.equal(paid.get("c"), 1);
}

function testScheduleHours() {
  const tuesdayEvening = new Date("2026-08-11T18:00:00");
  assert.equal(
    isPromotionScheduleActive(
      {
        startsOn: null,
        endsOn: null,
        activeDays: ["tuesday"],
        startTime: "17:00",
        endTime: "19:00",
      },
      tuesdayEvening,
    ),
    true,
  );
  assert.equal(
    isPromotionScheduleActive(
      {
        startsOn: null,
        endsOn: null,
        activeDays: ["tuesday"],
        startTime: "17:00",
        endTime: "19:00",
      },
      new Date("2026-08-11T20:00:00"),
    ),
    false,
  );
}

testSalePrice();
testBogoPaidQty();
testLineTotals();
testAssignBogoAcrossLines();
testScheduleHours();

function testBuiltLineBogo() {
  const promo = new Map([
    [
      "burger",
      {
        promotionId: "p1",
        kind: "bogo" as const,
        price: 10,
        compareAtPrice: null,
        displayOrder: 0,
      },
    ],
  ]);
  const priced = applyPromosToBuiltLines(
    [
      {
        itemId: "burger",
        quantity: 2,
        itemPrice: "10.00",
        customizationsTotal: "1.00",
        lineTotal: "21.00",
      },
    ],
    promo,
  );
  assert.equal(priced[0]?.lineTotal, "11.00");
}

function testCompareAtTotals() {
  assert.equal(
    guestLineCompareAtTotal({
      promoKind: "sale_price",
      chargedTotal: 16,
      quantity: 2,
      unitBasePrice: 8,
      compareAtPrice: 10,
      addOnsTotalPerUnit: 0,
    }),
    20,
  );
  assert.equal(
    guestLineCompareAtTotal({
      promoKind: "bogo",
      chargedTotal: 12,
      quantity: 2,
      unitBasePrice: 10,
      addOnsTotalPerUnit: 1,
    }),
    22,
  );
  assert.equal(
    guestLineCompareAtTotal({
      promoKind: "bogo",
      chargedTotal: 10,
      quantity: 1,
      unitBasePrice: 10,
    }),
    null,
  );
  assert.equal(
    guestLineCompareAtTotal({
      promoKind: null,
      chargedTotal: 10,
      quantity: 1,
      unitBasePrice: 10,
      compareAtPrice: 12,
    }),
    null,
  );
}

testBuiltLineBogo();
testCompareAtTotals();
console.log("promotions checks passed");

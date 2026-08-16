import assert from "node:assert/strict";
import {
  cartQuantityForCatalogItem,
  decrementGuestCartLine,
  guestCartCustomizationKey,
  mergeGuestCartAdd,
  replaceGuestCartItem,
} from "../src/lib/public-menu/guest-cart-lines";
import { groupIdenticalGuestLines } from "../src/lib/public-menu/groupGuestConfirmationItems";
import { groupOpsOrderItems } from "../src/lib/orders/groupOpsOrderItems";
import {
  parseStoredGuestCart,
  parseStoredGuestCartItem,
  pruneGuestCartAgainstMenu,
} from "../src/lib/public-menu/guest-cart-storage";

const pizza: GuestMenuItem = {
  id: "pizza-1",
  categoryId: "cat",
  name: "Pizza",
  description: "",
  price: 10,
  image: "",
  tags: [],
  status: "live",
};

function withToppings(optionId: string, quantity = 1): GuestCartItem {
  return {
    id: pizza.id,
    name: pizza.name,
    quantity,
    price: pizza.price,
    selectedOptions: { toppings: [optionId] },
  };
}

function testDifferentCustomizationsStaySeparate() {
  const first = mergeGuestCartAdd([], withToppings("pepperoni"), 1);
  const next = mergeGuestCartAdd(first, withToppings("mushrooms"), 1);
  assert.equal(next.length, 2);
  assert.equal(next[0].selectedOptions?.toppings[0], "pepperoni");
  assert.equal(next[1].selectedOptions?.toppings[0], "mushrooms");
  assert.notEqual(next[0].lineId, next[1].lineId);
  assert.equal(cartQuantityForCatalogItem(next, pizza.id), 2);
}

function testSameCustomizationsIncrement() {
  const first = mergeGuestCartAdd([], withToppings("pepperoni"), 1);
  const next = mergeGuestCartAdd(first, withToppings("pepperoni"), 1);
  assert.equal(next.length, 1);
  assert.equal(next[0].quantity, 2);
}

function testDecrementOnlyTouchesThatLine() {
  const two = mergeGuestCartAdd(
    mergeGuestCartAdd([], withToppings("pepperoni"), 1),
    withToppings("mushrooms"),
    1,
  );
  const pepperoniId = two[0].lineId ?? two[0].id;
  const { cart } = decrementGuestCartLine(two, pepperoniId);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].selectedOptions?.toppings[0], "mushrooms");
}

function testReplaceKeepsOtherLines() {
  const two = mergeGuestCartAdd(
    mergeGuestCartAdd([], withToppings("pepperoni"), 1),
    withToppings("mushrooms"),
    1,
  );
  const updated = replaceGuestCartItem(two, {
    ...two[0],
    selectedOptions: { toppings: ["olives"] },
  });
  assert.equal(updated.length, 2);
  assert.equal(updated[0].selectedOptions?.toppings[0], "olives");
  assert.equal(updated[1].selectedOptions?.toppings[0], "mushrooms");
}

function testCustomizationKeyIgnoresEmptySauce() {
  assert.equal(
    guestCartCustomizationKey({ selectedOptions: {}, sauceQuantities: { a: 0 } }),
    guestCartCustomizationKey({}),
  );
}

function testReplaceMissingLineIsNoop() {
  const cart = mergeGuestCartAdd([], withToppings("pepperoni"), 1);
  const next = replaceGuestCartItem(cart, {
    ...withToppings("mushrooms"),
    lineId: "missing",
  });
  assert.equal(next, cart);
}

function testIncrementSpecificLine() {
  const first = mergeGuestCartAdd([], withToppings("pepperoni"), 1);
  const second = mergeGuestCartAdd(first, withToppings("mushrooms"), 1);
  const bumped = mergeGuestCartAdd(second, { ...second[1], quantity: 1 }, 1);
  assert.equal(bumped[0].quantity, 1);
  assert.equal(bumped[1].quantity, 2);
}

testDifferentCustomizationsStaySeparate();
testSameCustomizationsIncrement();
testDecrementOnlyTouchesThatLine();
testReplaceKeepsOtherLines();
testCustomizationKeyIgnoresEmptySauce();
testReplaceMissingLineIsNoop();
testIncrementSpecificLine();
function testIdenticalKitchenRowsGroup() {
  const grouped = groupIdenticalGuestLines([
    {
      itemId: "pizza-1",
      itemName: "Pizza",
      quantity: 1,
      lineTotal: 10,
      notes: null,
      customizations: [{ groupId: "t", optionId: "pepperoni", quantity: 1 }],
    },
    {
      itemId: "pizza-1",
      itemName: "Pizza",
      quantity: 1,
      lineTotal: 10,
      notes: null,
      customizations: [{ groupId: "t", optionId: "pepperoni", quantity: 1 }],
    },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.quantity, 2);
  assert.equal(grouped[0]?.lineTotal, 20);
}

function testDifferentToppingsStaySeparate() {
  const grouped = groupIdenticalGuestLines([
    {
      itemId: "pizza-1",
      itemName: "Pizza",
      quantity: 1,
      lineTotal: 10,
      notes: null,
      customizations: [{ groupId: "t", optionId: "pepperoni", quantity: 1 }],
    },
    {
      itemId: "pizza-1",
      itemName: "Pizza",
      quantity: 1,
      lineTotal: 10,
      notes: null,
      customizations: [{ groupId: "t", optionId: "mushrooms", quantity: 1 }],
    },
  ]);
  assert.equal(grouped.length, 2);
}

testIdenticalKitchenRowsGroup();
testDifferentToppingsStaySeparate();
function testOpsCaesarRowsGroupByName() {
  const grouped = groupOpsOrderItems([
    { id: "a", name: "Cesar salad", qty: 1, price: 8, status: "pending" },
    { id: "b", name: "Cesar salad", qty: 1, price: 8, status: "pending" },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.qty, 2);
  assert.equal(grouped[0]?.price, 16);
}

function testSameOptionDifferentGroupIdsGroup() {
  const grouped = groupIdenticalGuestLines([
    {
      itemId: "salad",
      quantity: 1,
      lineTotal: 8,
      notes: null,
      customizations: [{ groupId: "g1", optionId: "dressing-1", quantity: 1 }],
    },
    {
      itemId: "salad",
      quantity: 1,
      lineTotal: 8,
      notes: null,
      customizations: [{ groupId: "g2", optionId: "dressing-1", quantity: 1 }],
    },
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0]?.quantity, 2);
}

testOpsCaesarRowsGroupByName();
testSameOptionDifferentGroupIdsGroup();

function testCartStorageParsesVersionedPayload() {
  const raw = JSON.stringify({
    v: 1,
    items: [
      {
        id: "pizza-1",
        lineId: "line-a",
        name: "Pizza",
        quantity: 2,
        price: 10,
        selectedOptions: { toppings: ["pepperoni"] },
      },
      { rewardId: "r1", id: "reward-line:r1", name: "Free drink", quantity: 1, price: 0 },
      { id: "", name: "Bad", quantity: 1, price: 1 },
    ],
  });
  const cart = parseStoredGuestCart(raw);
  assert.equal(cart.length, 1);
  assert.equal(cart[0]?.id, "pizza-1");
  assert.equal(cart[0]?.quantity, 2);
  assert.equal(cart[0]?.selectedOptions?.toppings[0], "pepperoni");
}

function testCartStorageRejectsRewardLines() {
  assert.equal(
    parseStoredGuestCartItem({
      id: "reward-line:r1",
      name: "Free drink",
      quantity: 1,
      price: 0,
      rewardId: "r1",
    }),
    null,
  );
}

function testCartStoragePrunesMissingMenuItems() {
  const cart: GuestCartItem[] = [
    { id: "keep", name: "Keep", quantity: 1, price: 5, lineId: "a" },
    { id: "gone", name: "Gone", quantity: 1, price: 5, lineId: "b" },
  ];
  const next = pruneGuestCartAgainstMenu(cart, new Set(["keep"]));
  assert.equal(next.length, 1);
  assert.equal(next[0]?.id, "keep");
}

testCartStorageParsesVersionedPayload();
testCartStorageRejectsRewardLines();
testCartStoragePrunesMissingMenuItems();
console.log("check-guest-cart-lines: ok");

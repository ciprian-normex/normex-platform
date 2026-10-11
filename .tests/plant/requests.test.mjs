import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionRank,
  defaultActionType,
  deriveParentStatus,
  hasDownstreamLinks,
  isOpenRequest
} from "../../modules/contractor/plant/requests/requests-model.js";

const items = (...statuses) => statuses.map((status, index) => ({ itemId: String(index), status }));

test("derives parent request lifecycle from item decisions", () => {
  assert.equal(deriveParentStatus(items("SUBMITTED", "SUBMITTED")), "SUBMITTED");
  assert.equal(deriveParentStatus(items("APPROVED", "APPROVED")), "APPROVED");
  assert.equal(deriveParentStatus(items("APPROVED", "REJECTED")), "PARTIALLY_APPROVED");
  assert.equal(deriveParentStatus(items("APPROVED", "DEFERRED")), "PARTIALLY_APPROVED");
  assert.equal(deriveParentStatus(items("IN_PROGRESS", "REJECTED")), "IN_PROGRESS");
  assert.equal(deriveParentStatus(items("COMPLETED", "REJECTED")), "COMPLETED");
  assert.equal(deriveParentStatus(items("REJECTED", "CANCELLED")), "REJECTED");
});

test("maps parent request types to item actions", () => {
  assert.equal(defaultActionType("PLANT_REQUIRED"), "ALLOCATE");
  assert.equal(defaultActionType("SERVICE_REPAIR"), "REPAIR");
  assert.equal(defaultActionType("MOVEMENT"), "MOVE");
  assert.equal(defaultActionType("OFF_HIRE"), "OFF_HIRE");
  assert.equal(defaultActionType("REPLACEMENT"), "REPLACE");
});

test("prioritises safety and urgent demand without conflating the fields", () => {
  assert.equal(attentionRank({ priority: "NORMAL", safetyCritical: true }), 1);
  assert.equal(attentionRank({ priority: "URGENT", safetyCritical: false }), 2);
  assert.equal(attentionRank({ status: "SUBMITTED", priority: "NORMAL" }), 3);
});

test("detects downstream links and excludes drafts from open demand", () => {
  assert.equal(hasDownstreamLinks({ items: [{ linkedMovementId: "MOV-1" }] }), true);
  assert.equal(hasDownstreamLinks({ items: [{ status: "APPROVED" }] }), false);
  assert.equal(isOpenRequest({ status: "DRAFT" }), false);
  assert.equal(isOpenRequest({ status: "PARTIALLY_APPROVED" }), true);
});

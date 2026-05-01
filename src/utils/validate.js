import mongoose from "mongoose";

export function validateObjectId(id, fieldName = "id") {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return new mongoose.Types.ObjectId(id);
}

export function validateEnum(value, allowed, fieldName = "value") {
  if (!allowed.includes(value)) {
    const err = new Error(`Invalid ${fieldName}`);
    err.status = 400;
    throw err;
  }
  return value;
}

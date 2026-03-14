import Student from "../models/Student.js";

export async function findTeacherStudentById(
  studentId,
  teacherId,
  select = "_id",
) {
  return Student.findOne({
    _id: studentId,
    teacherId,
  }).select(select);
}

export async function findParentStudentById(
  studentId,
  parentId,
  select = "_id",
) {
  return Student.findOne({
    _id: studentId,
    parentIds: parentId,
  }).select(select);
}

'use strict';

// Adds sample students so the app has something to show. Safe to run more than once.
const { openDb } = require('../db');
const students = require('../students');

const sample = [
  { name: 'Amina Wanjiru', email: 'amina.wanjiru@example.com', phone: '+254 712 345 678', course: 'Software Engineering', year: 2 },
  { name: 'Brian Otieno', email: 'brian.otieno@example.com', phone: '+254 723 456 789', course: 'Data Science', year: 3 },
  { name: 'Cynthia Mwangi', email: 'cynthia.mwangi@example.com', phone: '+254 734 567 890', course: 'Cyber Security', year: 1 },
  { name: 'David Kiprop', email: 'david.kiprop@example.com', phone: '+254 745 678 901', course: 'Software Engineering', year: 4 },
  { name: 'Esther Achieng', email: 'esther.achieng@example.com', phone: '+254 756 789 012', course: 'Business IT', year: 2 },
  { name: 'Felix Mutua', email: 'felix.mutua@example.com', phone: '+254 767 890 123', course: 'Data Science', year: 1 },
  { name: 'Grace Njeri', email: 'grace.njeri@example.com', phone: '', course: 'UI/UX Design', year: 3 },
  { name: 'Hassan Abdi', email: 'hassan.abdi@example.com', phone: '+254 778 901 234', course: 'Cyber Security', year: 2 },
];

const db = openDb();
let added = 0;
for (const student of sample) {
  try {
    students.create(db, student);
    added += 1;
  } catch (err) {
    if (!students.isDuplicateEmailError(err)) throw err;
  }
}
console.log(`Seed complete: ${added} added, ${sample.length - added} already existed.`);
db.close();

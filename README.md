# Student Management System

A web app for keeping student records. You can add students, see them in a list, search, edit their details and delete them.

It has three parts:

- **Frontend:** a single page in plain HTML, CSS and JavaScript (`public/`).
- **Backend:** a REST API built with Node.js (`app.js`, `students.js`, `validation.js`).
- **Database:** SQLite, stored in a file at `data/students.db`.

There are no packages to install. The server uses only what comes with Node.js.

## What you need

Node.js version 22.13 or newer. Check yours with:

```
node --version
```

If it is older (Ubuntu often has an old one), install a newer one with nvm:

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Close and reopen the terminal, then run `nvm install --lts`. On Windows, download Node.js from nodejs.org.

## Run it

```
npm start
```

Open http://localhost:3000 in your browser.

To fill it with some sample students first, run this once (it is safe to run again):

```
npm run seed
```

To use another port, set `PORT`, for example `PORT=4000 npm start`.

## Features

- Add a student (name, email, phone, course, year of study)
- View all students, with totals at the top
- Search by name, email or course
- Edit a student
- Delete a student, with a confirmation first
- Error messages next to the field that needs fixing
- Works on phones, and follows the light or dark setting of your device

## API

All data is sent and received as JSON.

| Method | Address | What it does |
| --- | --- | --- |
| GET | `/api/students` | List students. Add `?q=text` to search |
| GET | `/api/students/:id` | Get one student |
| POST | `/api/students` | Add a student |
| PUT | `/api/students/:id` | Replace a student's details |
| DELETE | `/api/students/:id` | Delete a student |
| GET | `/api/health` | Check that the server is running |

Example of a student:

```json
{
  "name": "Amina Wanjiru",
  "email": "amina.wanjiru@example.com",
  "phone": "+254 712 345 678",
  "course": "Software Engineering",
  "year": 2
}
```

Replies use these status codes: `200` ok, `201` created, `204` deleted, `400` bad data (with the problem for each field), `404` not found, `409` that email is already used.

### Rules for the data

- Name: 2 to 100 characters
- Email: must look like a real email, and each email can be used once
- Phone: optional, digits with spaces, `+`, `-` or brackets, 7 to 20 characters
- Course: 2 to 100 characters
- Year: a whole number from 1 to 6

## Tests

```
npm test
```

This runs 18 checks on the API. They cover adding, listing, searching, updating and deleting, bad data, duplicate emails, unknown ids, oversized requests and attempts to break into the database or read files outside the public folder. The tests use a temporary database, so your real records are not touched.

## Project files

```
server.js         starts the server
app.js            routes and static files
students.js       database queries
validation.js     checks the data before saving
db.js             opens the database and creates the table
public/           the web page (index.html, style.css, app.js)
scripts/seed.js   adds sample students
tests/            automated tests
docs/screenshots/ pictures of the app
```

## Screenshots

See the `docs/screenshots` folder: the student list, the add form with errors, the delete confirmation, the phone view and the dark theme.

const express = require("express");
const cors = require("cors");
const { ObjectId } = require("mongodb");
const MongoClient = require("mongodb").MongoClient;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { json } = require("body-parser");
require("dotenv").config();
const MongoUri = process.env.DB_CONNECTION_STRING;
const dbName = "datacentricproject";

let app = express();
app.use(cors());
app.use(express.json());
app.listen(4000, () => {
    console.log(
        "Server is running on port 4000\n\r" +
        "/register - Register a new user Body:[Email, Password, Department, Role]\n\r" +
        "/login - Login an existing user Body:[Email, Password]\n\r" +
        "/user - Get user details (Authorization header) [Email]\n\r" +
        "/users - Get all users (Authorization header) \n\r" +
        "/employees - Get all employees (Authorization header) \n\r" +
        "/employee/:id - Get employee details by ID (Authorization header) \n\r" +
        "/search/employee?firstName=...&lastName=... - Search employee by first and last name (Authorization header) \n\r" +
        "/employee/add - Add a new employee Body:[employee_id, first_name, last_name, email, phone, department, designation, date_of_joining, employment_type, location] (Authorization header) \n\r" +
        "/employee/update/:id - Update an existing employee by ID Body:[first_name, last_name, email, phone, department, designation, date_of_joining, employment_type, location] (Authorization header) \n\r" +
        "/employee/delete/:id - Delete an employee by ID (Authorization header)");
});
main();

async function connectToDatabase(Uri, dbName) {
    let client = await MongoClient.connect(Uri);
    let db = client.db(dbName);
    return db;
}
function authenticateToken(req, res, next) {
    let token = req.headers["authorization"];
    if (!token) { return res.sendStatus(403); }
    token = token.split(" ")[1]; // For "Bearer Token"
    if (!token) { return res.sendStatus(403); }
    jwt.verify(token, process.env.JWT_TOKEN_SECRET, (err, payload) => {
        if (err) { return res.sendStatus(403); }
        req.user = payload;
        next();
    });
}

//Email: admin@abc.com, Password: password123
async function main() {
    app.get("/", (req, res) => {
        res.send("Welcome to the Payroll Management System");
    });
    //Connect to the database
    let db = await connectToDatabase(MongoUri, dbName);
    //User registration (new user)
    //Example: http://localhost:4000/register
    //Body: { "Email": "user4@abc.com", "Password": "password123", "Department": "HR", "Role": "user" }
    app.post("/register", async (req, res) => {
        let { Email, Password, Department, Role } = req.body;
        let hashedPassword = await bcrypt.hash(Password, 10);
        let newUser = {
            "Email": Email,
            "Password": hashedPassword,
            "Department": Department,
            "Role": Role,
            "createdAt": new Date()
        };
        await db.collection("users").insertOne(newUser);
        res.status(201).send("User registered successfully");
    });
    //User login (existing user)
    //Example: http://localhost:4000/login
    //Body: { "Email": "admin@abc.com", "Password": "password123" }
    app.post("/login", async (req, res) => {
        let { Email, Password } = req.body;
        let user = await db.collection("users").findOne({ "Email": Email });
        if (!user) { return res.status(404).send("User not found"); }
        let isPasswordValid = await bcrypt.compare(Password, user.Password);
        if (!isPasswordValid) { return res.status(401).send("Invalid password"); }
        let token = jwt.sign({
            "Email": user.Email,
            "Role": user.Role
        },
            process.env.JWT_TOKEN_SECRET, {
            expiresIn: "1h"
        });
        res.status(200).json({ token });
    });
    //Get all users
    //Example: http://localhost:4000/users
    app.get("/users", authenticateToken, async (req, res) => {
        let users = await db.collection("users").find().toArray();
        res.status(200).json(users.map(user => ({
            email: user.Email,
            department: user.Department,
            role: user.Role,
            createdAt: user.createdAt
        })));
    });
    //Get user details (based on email)
    //Example: http://localhost:4000/user/admin@abc.com
    app.get("/user/:email", authenticateToken, async (req, res) => {
        let user = await db.collection("users").findOne({ "Email": req.params.email });
        if (!user) { return res.status(404).send("User not found"); }
        res.status(200).json({
            email: user.Email,
            department: user.Department,
            role: user.Role,
            createdAt: user.createdAt
        });
    });
    //Get all employees
    //Example: http://localhost:4000/employees
    app.get("/employees", authenticateToken, async (req, res) => {
        let employees = await db.collection("employees").find().toArray();
        res.status(200).json(employees.map(employee => ({
            "EmployeeID": employee.employee_id,
            "First Name": employee.first_name,
            "Last Name": employee.last_name,
            "Email": employee.email,
            "Phone": employee.phone,
            "Department": employee.department,
            "Designation": employee.designation,
            "Date of Joining": employee.date_of_joining,
            "Employment Type": employee.employment_type,
            "Location": employee.location
        })));
    });
    //Get Employee details (based on employee ID)
    //Example: http://localhost:4000/employee/E008
    app.get("/employee/:id", authenticateToken, async (req, res) => {
        let employee = await db.collection("employees").findOne({ "employee_id": req.params.id });
        if (!employee) { return res.status(404).send("Employee not found"); }
        res.status(200).json({
            "EmployeeID": employee.employee_id,
            "First Name": employee.first_name,
            "Last Name": employee.last_name,
            "Email": employee.email,
            "Phone": employee.phone,
            "Department": employee.department,
            "Designation": employee.designation,
            "Date of Joining": employee.date_of_joining,
            "Employment Type": employee.employment_type,
            "Location": employee.location
        });
    });
    //Search Employee by First Name and Last Name
    //Example: http://localhost:4000/search/employee?firstName=david&lastName=nguyen
    app.get("/search/employee", authenticateToken, async (req, res) => {
        let { firstName, lastName } = req.query;
        let query = {};
        if (firstName) {
            query.first_name = { $regex: new RegExp(firstName, "i") };
        }
        if (lastName) {
            query.last_name = { $regex: new RegExp(lastName, "i") };
        }
        let employees = await db.collection("employees").find(query).toArray();
        res.status(200).json(employees.map(employee => ({
            "EmployeeID": employee.employee_id,
            "First Name": employee.first_name,
            "Last Name": employee.last_name,
            "Email": employee.email,
            "Phone": employee.phone,
            "Department": employee.department,
            "Designation": employee.designation,
            "Date of Joining": employee.date_of_joining,
            "Employment Type": employee.employment_type,
            "Location": employee.location
        })));
    });
    //Add a new employee
    //Example: http://localhost:4000/employee/add
    //Body: {"employee_id": "E011", "first_name": "Jagan", "last_name": "Babu", "email": "jagan.babu@abc.com", "phone": "+65-00000000", "department": "Finance", "designation": "Financial Analyst", "date_of_joining": "2022-01-20", "employment_type": "Full-Time", "location": "New York"}
    app.post("/employee/add", authenticateToken, async (req, res) => {
        let { employee_id, first_name, last_name, email, phone, department, designation, date_of_joining, employment_type, location } = req.body;
        if (!employee_id || !first_name || !last_name || !email || !phone || !department || !designation || !date_of_joining || !employment_type || !location) {
            return res.status(400).send("All fields are required");
        }
        // Check if employee_id already exists
        let existingEmployee = await db.collection("employees").findOne({ employee_id });
        if (existingEmployee) {
            return res.status(400).send("Employee ID already exists");
        }
        let employee = {
            employee_id,
            first_name,
            last_name,
            email,
            phone,
            department,
            designation,
            date_of_joining: new Date(date_of_joining),
            employment_type,
            location
        };
        const result = await db.collection("employees").insertOne(employee);
        res.status(201).json({ message: "Employee added successfully", _Id: result.insertedId });
    });
    //Update an existing employee (based on Employee ID)
    //Example: http://localhost:4000/employee/update/E011
    //Body: {"first_name": "Jagan", "last_name": "Babu", "email": "jagan.babu@abc.com", "phone": "+65-00000000", "department": "Finance", "designation": "Financial Analyst", "date_of_joining": "2022-01-20", "employment_type": "Full-Time", "location": "New York"}
    app.put("/employee/update/:id", authenticateToken, async (req, res) => {
        let employeeId = req.params.id;
        // Check if employee exists
        let existingEmployee = await db.collection("employees").findOne({ employee_id: employeeId });
        if (!existingEmployee) {
            return res.status(404).send("Employee not found");
        }
        let { first_name, last_name, email, phone, department, designation, date_of_joining, employment_type, location } = req.body;
        if (!first_name || !last_name || !email || !phone || !department || !designation || !date_of_joining || !employment_type || !location) {
            return res.status(400).send("All fields are required");
        }
        let updatedEmployee = {
            first_name,
            last_name,
            email,
            phone,
            department,
            designation,
            date_of_joining: new Date(date_of_joining),
            employment_type,
            location
        };
        const result = await db.collection("employees").updateOne({ employee_id: employeeId }, { $set: updatedEmployee });
        if (result.matchedCount === 0) {
            return res.status(404).send("Employee not found");
        }
        res.status(200).json({ message: "Employee updated successfully" });
    });
    //Delete an employee (based on Employee ID)
    //Example: http://localhost:4000/employee/delete/E011
    app.delete("/employee/delete/:id", authenticateToken, async (req, res) => {
        let employeeId = req.params.id;
        // Check if employee exists
        let existingEmployee = await db.collection("employees").findOne({ employee_id: employeeId });
        if (!existingEmployee) {
            return res.status(404).send("Employee not found");
        }
        const result = await db.collection("employees").deleteOne({ employee_id: employeeId });
        if (result.deletedCount === 0) {
            return res.status(404).send("Employee not found");
        }
        res.status(200).json({ message: "Employee deleted successfully" });
    });
}
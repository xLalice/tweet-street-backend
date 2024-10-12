const express = require("express"); // Importing Express framework for building web applications.
const session = require("express-session"); // Importing express-session for session management.
const cors = require("cors"); // Importing CORS middleware to enable cross-origin requests.
const cookieParser = require("cookie-parser"); // Importing cookie-parser to parse cookies in requests.
const authRoutes = require("./routes/authRoutes"); // Importing authentication routes.
const postRoutes = require("./routes/postRoutes"); // Importing post-related routes.
const passport = require("./config/passport"); // Importing Passport configuration for authentication.
const { PrismaClient } = require("@prisma/client"); // Importing PrismaClient for database operations.
const schedulePost = require("./services/scheduler"); // Importing the function to schedule posts.

const app = express(); // Creating an instance of the Express application.

const prisma = new PrismaClient(); // Creating a new instance of PrismaClient to interact with the database.

// CORS middleware configuration to allow requests from the client.
app.use(
    cors({
        origin: process.env.CLIENT_URL, // Allow requests only from the specified client URL.
        methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods.
        credentials: true, // Allow credentials such as cookies.
    })
);

app.use(express.json()); // Middleware to parse incoming JSON requests.
app.use(cookieParser()); // Middleware to parse cookies from incoming requests.

// Session middleware configuration.
app.use(
    session({
        secret: process.env.JWT_SECRET, // Secret for signing the session ID cookie.
        resave: false, // Don't save session if unmodified.
        saveUninitialized: false, // Don't create session until something stored.
    })
);

app.use(passport.initialize()); // Initialize Passport for authentication.
app.use(passport.session()); // Use sessions to keep track of logged-in users.

// Mounting authentication and post-related routes.
app.use("/auth/", authRoutes); // Prefix for authentication routes.
app.use("/api/posts", postRoutes); // Prefix for post-related API routes.

console.log(`${process.env.BACKEND_URL}/auth/twitter/callback`); // Debugging line to log the Twitter callback URL.

// Function to load and schedule posts from the database.
async function loadScheduledPosts() {
    // Fetching scheduled posts from the database.
    const scheduledPosts = await prisma.post.findMany({
        where: {
            OR: [
                {
                    status: "SCHEDULED" // Include posts that are scheduled.
                },
                {
                    status: 'FAILED', // Include posts that previously failed to post.
                },
            ],
        },
        orderBy: {
            scheduledTime: "asc" // Order posts by scheduled time (ascending).
        }
    });

    console.log("Scheduled posts loaded:", scheduledPosts); // Debugging line to log the loaded posts.

    // Scheduling each post for publishing.
    for (const post of scheduledPosts) {
        console.log("Scheduling post:", post.id); // Debugging line to log the ID of each post being scheduled.
        await schedulePost(post.id); // Call the function to schedule the post.
    }
}

// Load and schedule posts when the server starts.
loadScheduledPosts();

const PORT = process.env.PORT || 3000; // Set the port to listen on, defaulting to 3000 if not specified.
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`); // Log a message indicating the server is running.
});

const express = require("express");
const session = require("express-session");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const postRoutes = require("./routes/postRoutes");
const passport = require("./config/passport");
const { PrismaClient } = require("@prisma/client");
const schedulePost = require("./services/scheduler");

const app = express();

const prisma = new PrismaClient();

app.set('trust proxy', 1);

app.use(
    cors({
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());
app.use(
    session({
        secret: process.env.JWT_SECRET,
        resave: false,
        saveUninitialized: false,
    })
);
app.use(passport.initialize());
app.use(passport.session());

app.use("/auth/", authRoutes);
app.use("/api/posts", postRoutes);  

console.log(`${process.env.BACKEND_URL}/auth/twitter/callback`)
async function loadScheduledPosts() {
    const scheduledPosts = await prisma.post.findMany({
        where: {
          OR: [
            {
              status: "SCHEDULED"
            },
            {
              status: 'FAILED',  // assuming there is a status field that tracks post status
            },
          ],
        },
        orderBy: {
            scheduledTime: "asc"
        }
      });

    console.log("Scheduled posts loaded:", scheduledPosts); // Debugging line

    for (const post of scheduledPosts) {
        console.log("Scheduling post:", post.id); // Debugging line
        await schedulePost(post.id);
    }
}

loadScheduledPosts();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

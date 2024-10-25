const express = require("express"); // Import the Express framework
const router = express.Router(); // Create a new Express router
const { PrismaClient } = require("@prisma/client"); // Import Prisma Client for database interactions
const prisma = new PrismaClient(); // Instantiate Prisma Client
const cron = require("node-cron"); // Import the node-cron package for scheduling tasks
const {postToSocialMedia} = require("../utils/socialMediaPoster"); // Import utility function to post content to social media
const passport = require("../config/passport"); // Import configured Passport instance for authentication
const { Platform, PostStatus } = require('@prisma/client'); // Import platform and post status enums from Prisma Client
const getCoordinates = require("../services/googleMapsService"); // Import service for retrieving geolocation data
const moment = require('moment-timezone'); // Import moment-timezone for handling time zones

// Route to fetch all posts for the authenticated user
router.get("/", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const userId = req.user.id; // Get user ID from authenticated request
    
    try {
        const posts = await prisma.post.findMany({ // Fetch posts belonging to the user
            where: {
                userId: userId, // Filter by user ID
            },
            include: {
                account: true // Include related social media account data
            },
            orderBy: {
                scheduledTime: 'asc', // Order posts by scheduled time in ascending order
            },
        });

        if (posts.length === 0) { // Check if there are no posts
            return res.status(404).json({ message: "No posts found" }); // Return a 404 response
        }

        const formattedPosts = posts.map((post) => ({
            id: post.id, // Map post properties to a new object for response
            content: post.content,
            scheduledTime: post.scheduledTime,
            platform: post.account.platform, // Include platform information
            status: post.status, 
            latitude: post.latitude,
            longitude: post.longitude
        }));

        res.status(200).json(formattedPosts); // Respond with the formatted posts
    } catch (error) {
        console.error("Error fetching posts:", error); // Log any errors
        res.status(500).json({ message: "Failed to fetch posts", error }); // Respond with a 500 error
    }
});

// Route to schedule a new post
router.post(
    "/schedule",
    passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        const userId = req.user.id;
        const { content, scheduledTime, location, imageUrl } = req.body;

        try {
            // Validate required fields
            if (!content || !scheduledTime || !location) {
                return res.status(400).json({ 
                    message: "Missing required fields: content, scheduledTime, and location are required" 
                });
            }

            // Validate scheduled time is in the future
            const scheduledMoment = moment.tz(scheduledTime, 'Asia/Manila');
            if (scheduledMoment.isBefore(moment())) {
                return res.status(400).json({ 
                    message: "Scheduled time must be in the future" 
                });
            }

            const account = await prisma.socialMediaAccount.findUnique({
                where: {
                    userId_platform: {
                        userId: userId,
                        platform: 'TWITTER'
                    }
                }
            });

            if (!account) {
                return res.status(404).json({ 
                    message: "Social media account not found" 
                });
            }

            const { lat, lng, formattedAddress } = await getCoordinates(location);
            
            // Convert the scheduled time to UTC
            const scheduledTimeInUTC = scheduledMoment.utc().toDate();

            const post = await prisma.post.create({
                data: {
                    userId,
                    accountId: account.id,
                    content,
                    location: formattedAddress,
                    latitude: lat,
                    longitude: lng,
                    scheduledTime: scheduledTimeInUTC,
                    status: 'SCHEDULED',
                    imageUrl 
                },
            });

            await schedulePost(post);

            res.status(201).json({
                message: "Post scheduled successfully",
                post,
            });
        } catch (error) {
            console.error("Error scheduling post:", error);
            
            // Provide more specific error messages based on the error type
            if (error.code === 'P2002') {
                return res.status(400).json({ 
                    message: "A post with these details already exists" 
                });
            }
            
            res.status(500).json({ 
                message: "Failed to schedule post",
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// Function to schedule a post for publishing
const schedulePost = (post) => {
    const now = new Date(); // Get the current date and time

    if (post.scheduledTime > now) { // Check if the scheduled time is in the future
        const scheduledTime = new Date(post.scheduledTime); // Convert the scheduled time to a Date object

        cron.schedule( // Schedule a cron job for the post
            `${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${scheduledTime.getMonth() + 1} *`, // Set cron schedule based on scheduled time
            async () => { // Define the task to execute
                try {
                    await postToSocialMedia(post); // Post the content to social media
                } catch (error) {
                    console.error("Error posting to social media:", error); // Log any posting errors
                }
            }
        );
    } else { // If the scheduled time is in the past
        postToSocialMedia(post); // Immediately post the content to social media
    }
};

// Route to create a new post
router.post(
    "/",
    passport.authenticate("jwt", { session: false }), // Authenticate the request
    async (req, res) => {
        const accountId = req.user; // Get the account ID from the authenticated request
        const { content, location } = req.body; // Destructure content and location from request body

        try {
            const post = await prisma.post.create({ // Create a new post record in the database
                data: {
                    accountId, // Associate with the user's account
                    content,
                    location,
                    status: PostStatus.POSTED, // Set the status to "POSTED"
                },
            });

            await postToSocialMedia(post); // Post the content to social media

            res.status(201).json({ // Respond with the created post data
                message: "Post published successfully",
                post,
            });
        } catch (error) {
            console.error("Error publishing post:", error); // Log any errors
            res.status(500).json({ message: "Failed to publish post", error }); // Respond with a 500 error
        }
    }
);

// Route to update an existing post
router.put("/:postId", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const accountId = req.user; // Get the account ID from the authenticated request
    const postId = parseInt(req.params.postId); // Parse post ID from request parameters
    const { content, scheduledTime } = req.body; // Destructure content and scheduled time from request body

    try {
        if (!content || !scheduledTime) { // Check if required fields are provided
            return res.status(400).json({ error: "Content and scheduled time are required." }); // Return a 400 response if missing
        }

        const existingPost = await prisma.post.findUnique({ // Check if the post exists
            where: { id: postId },
        });

        if (!existingPost) { // If the post does not exist
            return res.status(404).json({ error: "Post not found." }); // Return a 404 response
        }

        const post = await prisma.post.update({ // Update the existing post with new data
            where: { id: postId },
            data: {
                content, // Update content
                scheduledTime: new Date(scheduledTime), // Update scheduled time
            },
        });

        return res.status(200).json(post); // Respond with the updated post data
    } catch (error) {
        console.error("Error updating post:", error); // Log any errors
        if (error.code === 'P2025') { // Check for Prisma error code indicating the post was not found
            return res.status(404).json({ error: "Post not found." }); // Return a 404 response
        }
        return res.status(500).json({ error: "An error occurred while updating the post." }); // Return a 500 error for other issues
    }
});

module.exports = router; // Export the router for use in the main application

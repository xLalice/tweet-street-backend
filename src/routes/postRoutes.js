const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const cron = require("node-cron");
const postToSocialMedia = require("../utils/socialMediaPoster");
const passport = require("../config/passport");
const { Platform, PostStatus } = require('@prisma/client');
const getCoordinates = require("../services/googleMapsService");
const moment = require('moment-timezone');

router.get("/", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const userId = req.user.id;
    
    try {
        const posts = await prisma.post.findMany({
            where: {
                userId: userId,
            },
            include: {
                account: true
            },
            orderBy: {
                scheduledTime: 'asc',
            },
        });

        if (posts.length === 0) {
            return res.status(404).json({ message: "No posts found" });
        }

        const formattedPosts = posts.map((post) => ({
            id: post.id,
            content: post.content,
            scheduledTime: post.scheduledTime,
            platform: post.account.platform,  
            status: post.status, 
            latitude: post.latitude,
            longitude: post.longitude
        }));

        res.status(200).json(formattedPosts);
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ message: "Failed to fetch posts", error });
    }
});

router.post(
    "/schedule",
    passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        const userId = req.user.id; 
        const { content, scheduledTime, location } = req.body;

        try {
            const account = await prisma.socialMediaAccount.findUnique({
                where: {
                    userId_platform: {
                        userId: userId,
                        platform: Platform.TWITTER
                    }
                }
            });

            if (!account) {
                return res.status(404).json({ message: "Social media account not found" });
            }

            const { lat, lng, formattedAddress } = await getCoordinates(location);

            const scheduledTimeInUTC = moment.tz(scheduledTime, 'Asia/Manila').utc().toDate();

            const post = await prisma.post.create({
                data: {
                    userId: userId,
                    accountId: account.id,
                    content,
                    location: formattedAddress, 
                    latitude: lat,              
                    longitude: lng,             
                    scheduledTime: scheduledTimeInUTC,
                    status: "SCHEDULED",
                },
            });

            schedulePost(post);

            res.status(201).json({
                message: "Post scheduled successfully",
                post,
            });
        } catch (error) {
            console.error("Error scheduling post:", error);
            res.status(500).json({ message: "Failed to schedule post", error });
        }
    }
);


const schedulePost = (post) => {
    const now = new Date();

    if (post.scheduledTime > now) {
        const scheduledTime = new Date(post.scheduledTime);

        cron.schedule(
            `${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${
                scheduledTime.getMonth() + 1
            } *`,
            async () => {
                try {
                    await postToSocialMedia(post);
                    console.log("Post successfully published:", post.id);
                } catch (error) {
                    console.error("Error posting to social media:", error);
                }
            }
        );
    } else {
        postToSocialMedia(post);
    }
};

router.post(
    "/",
    passport.authenticate("jwt", { session: false }),
    async (req, res) => {
        const accountId = req.user;
        const { content, location } = req.body;

        try {
            const post = await prisma.post.create({
                data: {
                    accountId,
                    content,
                    location,
                    status: PostStatus.POSTED,
                },
            });

            await postToSocialMedia(post);

            res.status(201).json({
                message: "Post published successfully",
                post,
            });
        } catch (error) {
            console.error("Error publishing post:", error);
            res.status(500).json({ message: "Failed to publish post", error });
        }
    }
);

router.put("/:postId", passport.authenticate("jwt", { session: false }), async (req, res) => {
    const accountId = req.user;
    const postId  = parseInt(req.params.postId);
    const { content, scheduledTime } = req.body;

    try {
        if (!content || !scheduledTime) {
            return res.status(400).json({ error: "Content and scheduled time are required." });
        }

        const existingPost = await prisma.post.findUnique({
            where: { id: postId },
        });

        if (!existingPost) {
            return res.status(404).json({ error: "Post not found." });
        }

        const post = await prisma.post.update({
            where: { id: postId },
            data: {
                content,
                scheduledTime: new Date(scheduledTime),
            },
        });

        return res.status(200).json(post);
    } catch (error) {
        console.error("Error updating post:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: "Post not found." });
        }
        return res.status(500).json({ error: "An error occurred while updating the post." });
    }
});



module.exports = router;

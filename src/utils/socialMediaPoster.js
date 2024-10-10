const { PrismaClient, PostStatus } = require("@prisma/client");
const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");

const prisma = new PrismaClient();

const postToTwitter = async (
    accessToken,
    accessTokenSecret,
    content,
    lat,
    long
) => {
    if (content.length > 280) {
        throw new Error("Tweet content exceeds the 280 character limit.");
    }

    const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY,
        appSecret: process.env.TWITTER_CONSUMER_SECRET,
        accessToken,
        accessSecret: accessTokenSecret,
    });

    try {
        console.log("Post to twitter called");
        const response = await twitterClient.v2.tweet({
            text: content
        });

        return response;
    } catch (error) {
        console.error("Error posting tweet:", error);
        throw error;
    }
};

const postToSocialMedia = async (post) => {
    const account = await prisma.socialMediaAccount.findUnique({
        where: { id: post.accountId },
    });

    try {
        await postToTwitter(
            account.accessToken,
            account.accessTokenSecret,
            post.content,
            post.latitude,
            post.longitude
        );

        await prisma.post.update({
            where: { id: post.id },
            data: { status: PostStatus.POSTED },
        });
    } catch (error) {
        console.error("Failed to post to social media:", error);
        await prisma.post.update({
            where: { id: post.id },
            data: { status: PostStatus.FAILED },
        });
    }
};

module.exports = postToSocialMedia;

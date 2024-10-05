const { PrismaClient, PostStatus, Platform } = require("@prisma/client");
const axios = require("axios");
const prisma = new PrismaClient();
const { TwitterApi } = require("twitter-api-v2");

const postToTwitter = async (accessToken, accessTokenSecret, content) => {
    console.log("Content: ", content);
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
        const response = await twitterClient.v2.tweet(content);
        console.log("Tweet posted successfully:", response);
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

    await postToTwitter(
        account.accessToken,
        account.accessTokenSecret,
        post.content
    );

    await prisma.post.update({
        where: { id: post.id },
        data: { status: PostStatus.POSTED },
    });
};

module.exports = postToSocialMedia;

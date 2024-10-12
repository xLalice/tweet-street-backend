const { PrismaClient, PostStatus } = require("@prisma/client"); // Importing PrismaClient and PostStatus for database operations.
const axios = require("axios"); // Importing axios for making HTTP requests.
const { TwitterApi } = require("twitter-api-v2"); // Importing TwitterApi to interact with the Twitter API.

const prisma = new PrismaClient(); // Creating a new instance of PrismaClient to interact with the database.

// Function to post a tweet to Twitter.
const postToTwitter = async (
    accessToken, // Access token for the user's Twitter account.
    accessTokenSecret, // Access token secret for the user's Twitter account.
    content, // Content of the tweet.
    lat, // Latitude for location (optional).
    long // Longitude for location (optional).
) => {
    // Check if the tweet content exceeds the 280 character limit.
    if (content.length > 280) {
        throw new Error("Tweet content exceeds the 280 character limit."); // Throw an error if content is too long.
    }

    // Creating a Twitter client instance with the necessary credentials.
    const twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY, // Consumer key from environment variables.
        appSecret: process.env.TWITTER_CONSUMER_SECRET, // Consumer secret from environment variables.
        accessToken, // User's access token.
        accessSecret: accessTokenSecret, // User's access secret.
    });

    try {
        console.log("Post to twitter called"); // Log that the post function was called.
        // Sending a tweet with the provided content.
        const response = await twitterClient.v2.tweet({
            text: content // The tweet text.
        });

        return response; // Return the response from Twitter API.
    } catch (error) {
        console.error("Error posting tweet:", error); // Log any errors encountered.
        throw error; // Re-throw the error for further handling.
    }
};

// Function to post content to social media.
const postToSocialMedia = async (post) => {
    // Fetch the associated social media account from the database.
    const account = await prisma.socialMediaAccount.findUnique({
        where: { id: post.accountId }, // Find account by ID linked to the post.
    });

    try {
        // Call the postToTwitter function with the necessary parameters.
        await postToTwitter(
            account.accessToken, // User's access token from the social media account.
            account.accessTokenSecret, // User's access token secret.
            post.content, // Content of the post to tweet.
            post.latitude, // Latitude of the post location.
            post.longitude // Longitude of the post location.
        );

        // Update the post status in the database to indicate it has been posted.
        await prisma.post.update({
            where: { id: post.id }, // Find the post by ID.
            data: { status: PostStatus.POSTED }, // Set status to POSTED.
        });
    } catch (error) {
        console.error("Failed to post to social media:", error); // Log the error if posting fails.
        // Update the post status to FAILED in the database.
        await prisma.post.update({
            where: { id: post.id },
            data: { status: PostStatus.FAILED }, // Set status to FAILED.
        });
    }
};

// Exporting the postToSocialMedia function for use in other modules.
module.exports = {
    postToSocialMedia,
};

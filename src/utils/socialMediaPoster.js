const { PrismaClient, PostStatus } = require("@prisma/client"); // Import PrismaClient and PostStatus for database operations.
const { TwitterApi } = require("twitter-api-v2"); // Import TwitterApi to interact with the Twitter API.
const axios = require("axios");

const prisma = new PrismaClient(); // Create a new PrismaClient instance to interact with the database.

// Function to post a tweet to Twitter.
const postToTwitter = async (
    accessToken,
    accessTokenSecret,
    content,
    imageUrl = null
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
      console.log("Post to Twitter called");
      
      // Create a client for v1 and v2 methods
      const v1Client = twitterClient.v1;
      const v2Client = twitterClient.v2;
      
      // Handle image upload if provided
      let mediaIds = [];
      if (imageUrl) {
        try {
          const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const mediaBuffer = Buffer.from(response.data, 'binary');
          
          // Upload media using v1.1 endpoint
          const mediaResponse = await v1Client.uploadMedia(mediaBuffer, { 
            mimeType: "image/jpeg" 
          });
          console.log("Media uploaded successfully:", mediaResponse);
          mediaIds.push(mediaResponse);
        } catch (mediaError) {
          console.error("Error uploading media:", mediaError);
          throw new Error("Failed to upload media: " + mediaError.message);
        }
      }
  
      // Construct the tweet payload
      const tweetData = {
        text: content,
      };
  
      // Add media if we have any
      if (mediaIds.length > 0) {
        tweetData.media = { 
          media_ids: mediaIds 
        };
      }
  
      console.log("Sending tweet with payload:", JSON.stringify(tweetData, null, 2));
  
      // Send the tweet using v2 endpoint
      const response = await v2Client.tweet(tweetData);
      console.log("Tweet response:", response);
  
      if (response.errors) {
        console.error("Error response from Twitter:", response.errors);
        throw new Error("Failed to post tweet: " + response.errors.map(err => err.message).join(", "));
      }
  
      return response;
    } catch (error) {
      console.error("Error posting tweet:", error);
      throw error;
    }
  };

// Function to post content to social media.
const postToSocialMedia = async (post) => {
    const account = await prisma.socialMediaAccount.findUnique({
        where: { id: post.accountId },
    });

    try {
        const response = await postToTwitter(
            account.accessToken,
            account.accessTokenSecret,
            post.content,
            post.imageUrl,
            post.latitude,
            post.longitude
        );

        // If posting was successful, update post status to POSTED
        if (!response.errors) {
            await prisma.post.update({
                where: { id: post.id },
                data: { status: PostStatus.POSTED },
            });
        } else {
            await prisma.post.update({
                where: { id: post.id },
                data: { status: PostStatus.FAILED },
            });
        }
    } catch (error) {
        console.error("Failed to post to social media:", error);

        // Update post status to FAILED in case of an error
        await prisma.post.update({
            where: { id: post.id },
            data: { status: PostStatus.FAILED },
        });
    }
};

module.exports = {
    postToSocialMedia,
};

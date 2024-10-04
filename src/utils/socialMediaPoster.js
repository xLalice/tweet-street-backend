const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();
const Twit = require('twit');


const postToFacebook = async (accountId, accessToken, content, location) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v12.0/me/feed`,
      {
        message: content,
        place: location,
      },
      {
        params: { access_token: accessToken },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error posting to Facebook:', error);
    throw error;
  }
};

const postToTwitter = async (accountId, accessToken, accessTokenSecret, content, location) => {
  const T = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: accessToken,
    access_token_secret: accessTokenSecret,
    timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
  });

  // Check for character limit (280 characters for tweets)
  if (content.length > 280) {
    throw new Error('Tweet content exceeds the 280 character limit.');
  }

  try {
    // Prepare tweet data
    const tweetData = {
      status: content,
    };

    // Include location if provided
    if (location) {
      tweetData.coordinates = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude], // Twitter requires longitude first
      };
    }

    // Post the tweet
    const response = await T.post('statuses/update', tweetData);
    
    console.log('Tweet posted successfully:', response.data);
    return response.data; // Return the response data if needed
  } catch (error) {
    console.error('Error posting tweet:', error.message);
    throw error; // Re-throw the error for further handling
  }
};

const postToSocialMedia = async (post) => {
  const account = await prisma.socialMediaAccount.findUnique({
    where: { id: post.accountId },
  });

  if (account.platform === 'facebook') {
    await postToFacebook(account.accountId, account.accessToken, post.content, post.location);
  } else if (account.platform === 'twitter') {
    await postToTwitter(account.accountId, account.accessToken, account.refreshToken, post.content, post.location);
  }

  await prisma.post.update({
    where: { id: post.id },
    data: { status: 'posted' },
  });
};

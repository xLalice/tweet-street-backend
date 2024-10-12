const passport = require('passport'); // Import Passport for authentication
const TwitterStrategy = require('passport-twitter').Strategy; // Import Twitter Strategy for OAuth
const { PrismaClient, Platform } = require('@prisma/client'); // Import Prisma Client and Platform enum
const { ExtractJwt } = require('passport-jwt'); // Extract JWT from request headers
const JwtStrategy  = require("passport-jwt").Strategy; // Import JWT Strategy for authentication
const prisma = new PrismaClient(); // Instantiate Prisma Client for database access

// JWT options for the authentication strategy
const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extract JWT from Bearer token in headers
  secretOrKey: process.env.JWT_SECRET, // Secret key for verifying the JWT
};

// Serialize user information into the session
passport.serializeUser((user, done) => {
  done(null, user.id); // Store user ID in the session
});

// Deserialize user information from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } }); // Retrieve user by ID from the database
    done(null, user); // Pass user information to the done callback
  } catch (error) {
    done(error); // Handle errors during deserialization
  }
});

// JWT Strategy for authenticating requests with JWT
passport.use(
  new JwtStrategy(opts, async (jwtPayload, done) => {
    try {
      const user = await prisma.user.findFirst({where : { id: jwtPayload.id}}); // Find user based on JWT payload
      return done(null, user || false); // Return user or false if not found
    } catch (error) {
      return done(error, false); // Handle errors during authentication
    }
  })
);

// Twitter authentication strategy for OAuth
passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY, // Twitter API consumer key
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET, // Twitter API consumer secret
  callbackURL: `${process.env.BACKEND_URL}/auth/twitter/callback` // URL to redirect after Twitter authentication
}, async (token, tokenSecret, profile, done) => {
  try {
    // Check if user already exists in the database using Twitter ID
    let user = await prisma.user.findUnique({ where: { twitterId: profile.id } });

    console.log(profile); // Log the profile information for debugging
    if (!user) {
      // If user doesn't exist, create a new user in the database
      user = await prisma.user.create({
        data: {
          twitterId: profile.id, // Store Twitter ID
          name: profile.screen_name, // Store Twitter username
        },
      });
    }

    // Upsert the social media account information in the database
    await prisma.socialMediaAccount.upsert({
      where: { userId_platform: { userId: user.id, platform: Platform.TWITTER } },
      update: { accessToken: token, accessTokenSecret: tokenSecret }, // Update existing account with new tokens
      create: {
        userId: user.id, // Link account to the user
        platform: Platform.TWITTER, // Specify the platform as Twitter
        accountId: profile.id, // Store the Twitter account ID
        accessToken: token, // Store the access token
        accessTokenSecret: tokenSecret, // Store the access token secret
      },
    });

    done(null, user); // Pass the user object to the done callback
  } catch (error) {
    done(error); // Handle errors during Twitter authentication
  }
}));

module.exports = passport; // Export the configured Passport instance

const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const { PrismaClient, Platform } = require('@prisma/client');

const prisma = new PrismaClient();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error);
  }
});

passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/callback",
  profileFields: ['id', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await prisma.user.findUnique({ where: { facebookId: profile.id } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          facebookId: profile.id,
          email: profile.emails[0].value,
        },
      });
    }

    await prisma.socialMediaAccount.upsert({
      where: { userId_platform: { userId: user.id, platform: Platform.FACEBOOK } },
      update: { accessToken, refreshToken },
      create: {
        userId: user.id,
        platform: Platform.FACEBOOK,
        accountId: profile.id,
        accessToken,
        refreshToken,
      },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
}));

passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: "http://localhost:3000/auth/twitter/callback"
}, async (token, tokenSecret, profile, done) => {
  try {
    let user = await prisma.user.findUnique({ where: { twitterId: profile.id } });

    console.log(profile);
    if (!user) {
      user = await prisma.user.create({
        data: {
          twitterId: profile.id,
          name: profile.screen_name,
        },
      });
    }

    await prisma.socialMediaAccount.upsert({
      where: { userId_platform: { userId: user.id, platform: Platform.TWITTER } },
      update: { accessToken: token, refreshToken: tokenSecret },
      create: {
        userId: user.id,
        platform: Platform.TWITTER,
        accountId: profile.id,
        accessToken: token,
        refreshToken: tokenSecret,
      },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
}));

module.exports = passport;
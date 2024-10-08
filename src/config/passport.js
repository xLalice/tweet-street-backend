const passport = require('passport');
const TwitterStrategy = require('passport-twitter').Strategy;
const { PrismaClient, Platform } = require('@prisma/client');
const { ExtractJwt } = require('passport-jwt');
const JwtStrategy  = require("passport-jwt").Strategy;
const prisma = new PrismaClient();

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

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

passport.use(
  new JwtStrategy(opts, async (jwtPayload, done) => {
    try {
      const user = await prisma.user.findFirst({where : { id: jwtPayload.id}});
      return done(null, user || false);
    } catch (error) {
      return done(error, false);
    }
  })
);



passport.use(new TwitterStrategy({
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  callbackURL: `${process.env.BACKEND_URL}/auth/twitter/callback`
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
      update: { accessToken: token, accessTokenSecret: tokenSecret },
      create: {
        userId: user.id,
        platform: Platform.TWITTER,
        accountId: profile.id,
        accessToken: token,
        accessTokenSecret: tokenSecret,
      },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
}));

module.exports = passport;
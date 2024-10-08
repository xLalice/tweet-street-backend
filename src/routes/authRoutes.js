const express = require("express");
const passport = require("../config/passport");
const generateToken = require("../utils/token");
const router = express.Router();

router.get(
  '/verify',
  passport.authenticate('jwt', { session: false }),
  (req, res) => {
    res.status(200).json({
      authenticated: true,
      userId: req.user.id,
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
      },
    });
  }
);

router.get('/twitter', passport.authenticate('twitter'));
router.get('/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/login' }),
  (req, res) => {
    console.log("Callback called");
    
    const token = generateToken(req.user);

    res.cookie('authToken', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 3600000,
      sameSite: "None"
    });
    res.redirect(process.env.CLIENT_URL);
  }
);

router.post('/logout', (req, res) => {
  res.clearCookie('authToken');
  
  res.status(200).json({ message: 'Logout successful' });
});

module.exports = router;

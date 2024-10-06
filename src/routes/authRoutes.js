const express = require("express");
const passport = require("../config/passport")
const generateToken = require("../utils/token")
const router = express.Router();

router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    console.log("Callback called");
    const token = generateToken(req.user);

    res.cookie('authToken', token, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 3600000
    });
    res.redirect('http://localhost:5173/');
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
      maxAge: 3600000
    });
    res.redirect('http://localhost:5173/');
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

module.exports = router;
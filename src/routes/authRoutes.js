const express = require("express"); // Import the Express framework
const passport = require("../config/passport"); // Import configured Passport instance for authentication
const generateToken = require("../utils/token"); // Import utility function for generating JWTs
const router = express.Router(); // Create a new Express router

// Route for verifying JWT authentication
router.get(
  '/verify',
  passport.authenticate('jwt', { session: false }), // Authenticate using JWT without session management
  (req, res) => {
    res.status(200).json({
      authenticated: true, // Indicate that the user is authenticated
      userId: req.user.id, // Return the authenticated user's ID
      user: {
        firstName: req.user.firstName, // Return the user's first name
        lastName: req.user.lastName, // Return the user's last name
        email: req.user.email, // Return the user's email
      },
    });
  }
);

// Initiate Twitter authentication
router.get('/twitter', passport.authenticate('twitter'));

// Callback route for Twitter authentication
router.get('/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/login' }), // Authenticate using Twitter; redirect on failure
  (req, res) => {
    console.log("Callback called"); // Log when the callback is invoked
    
    const token = generateToken(req.user); // Generate a JWT for the authenticated user

    // Redirect to the client URL with the token as a query parameter
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  }
);

// Route for logging out the user
router.post('/logout', (req, res) => {
  res.clearCookie('authToken'); // Clear the authentication cookie
  
  res.status(200).json({ message: 'Logout successful' }); // Respond with a success message
});

module.exports = router; // Export the router for use in the main application

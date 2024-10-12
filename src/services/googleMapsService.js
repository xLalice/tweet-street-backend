const axios = require("axios"); // Importing the axios library for making HTTP requests.
require("dotenv").config(); // Load environment variables from a .env file into process.env.

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Retrieve the Google Maps API key from environment variables.

const getCoordinates = async (location) => {
    try {
        // Make a GET request to the Google Maps Geocoding API with the specified location and API key.
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
                params: {
                    address: location, // The address to get coordinates for.
                    key: GOOGLE_MAPS_API_KEY, // The API key for authentication.
                },
            }
        );

        // Check if the API response status is 'OK', indicating a successful request.
        if (response.data.status === "OK") {
            // Destructure latitude and longitude from the API response.
            const { lat, lng } = response.data.results[0].geometry.location;
            // Get the formatted address from the API response.
            const formattedAddress = response.data.results[0].formatted_address;
            // Return the latitude, longitude, and formatted address.
            return { lat, lng, formattedAddress };
        } else {
            // Throw an error if the location is invalid or not found.
            throw new Error("Invalid location");
        }
    } catch (error) {
        // Log the error for debugging purposes.
        console.error("Error fetching coordinates:", error);
        // Re-throw the error for handling in the calling function.
        throw error;
    }
};

// Export the getCoordinates function for use in other modules.
module.exports = getCoordinates;

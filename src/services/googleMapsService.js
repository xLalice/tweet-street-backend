const axios = require("axios");
require("dotenv").config();

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY; 

const getCoordinates = async (location) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
                params: {
                    address: location,
                    key: GOOGLE_MAPS_API_KEY,
                },
            }
        );

        if (response.data.status === "OK") {
            const { lat, lng } = response.data.results[0].geometry.location;
            const formattedAddress = response.data.results[0].formatted_address;
            return { lat, lng, formattedAddress };
        } else {
            throw new Error("Invalid location");
        }
    } catch (error) {
        console.error("Error fetching coordinates:", error);
        throw error;
    }
};

module.exports = getCoordinates;

const cron = require('node-cron'); // Importing the node-cron library for scheduling tasks.
const { PrismaClient } = require('@prisma/client'); // Importing PrismaClient for database operations.
const { postToSocialMedia } = require('../utils/socialMediaPoster'); // Importing the function to post to social media.

const prisma = new PrismaClient(); // Creating a new instance of PrismaClient to interact with the database.
const scheduledJobs = new Map(); // Using a Map to store scheduled jobs by postId.

async function schedulePost(postId) {
  // Fetching the post details from the database using the provided postId.
  const post = await prisma.post.findUnique({
    where: { id: postId }, // Searching for a post with the given ID.
    include: { account: true }, // Including the associated account information.
  });

  // If the post is not found, log an error and exit the function.
  if (!post) {
    console.error(`Post with id ${postId} not found`);
    return;
  }

  const scheduledTime = new Date(post.scheduledTime); // Convert scheduledTime to a Date object.
  const currentTime = new Date(); // Get the current time.

  // If the scheduled time is in the past, post immediately.
  if (scheduledTime <= currentTime) {
    console.log(`Scheduled time is in the past for post ${postId}, posting immediately.`);
    try {
      await postToSocialMedia(post); // Attempt to post to social media.
      await prisma.post.update({
        where: { id: postId }, // Update the post status in the database.
        data: { status: 'POSTED' }, // Set status to 'POSTED'.
      });
      console.log(`Post ${postId} published successfully`); // Log success message.
    } catch (error) {
      // If posting fails, log the error and update the post status.
      console.error(`Failed to publish post ${postId}:`, error);
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED' }, // Set status to 'FAILED'.
      });
    }
    return; // Exit the function after posting immediately.
  }

  // Create a cron expression based on the scheduled time.
  const cronExpression = `${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${scheduledTime.getMonth() + 1} *`;

  // If a job for this postId already exists, stop it and remove it from the Map.
  if (scheduledJobs.has(postId)) {
    const existingJob = scheduledJobs.get(postId);
    existingJob.stop(); // Stop the existing job.
    scheduledJobs.delete(postId); // Remove it from the scheduled jobs Map.
  }

  // Schedule a new cron job to post at the specified scheduled time.
  const job = cron.schedule(cronExpression, async () => {
    try {
      await postToSocialMedia(post); // Attempt to post to social media.
      await prisma.post.update({
        where: { id: postId }, // Update the post status in the database.
        data: { status: 'POSTED' }, // Set status to 'POSTED'.
      });
      console.log(`Post ${postId} published successfully`); // Log success message.
    } catch (error) {
      // If posting fails, log the error and update the post status.
      console.error(`Failed to publish post ${postId}:`, error);
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED' }, // Set status to 'FAILED'.
      });
    } finally {
      job.stop(); // Stop the job after it runs.
      scheduledJobs.delete(postId); // Remove the job from the scheduled jobs Map.
    }
  });

  scheduledJobs.set(postId, job); // Store the new job in the Map with postId as the key.
  job.start(); // Start the scheduled job.
}

// Export the schedulePost function for use in other modules.
module.exports = schedulePost;

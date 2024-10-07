const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { postToSocialMedia } = require('../utils/socialMediaPoster');

const prisma = new PrismaClient();
const scheduledJobs = new Map();

async function schedulePost(postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { account: true },
  });

  if (!post) {
    console.error(`Post with id ${postId} not found`);
    return;
  }

  if (scheduledJobs.has(postId)) {
    const existingJob = scheduledJobs.get(postId);
    existingJob.stop();
    scheduledJobs.delete(postId);
  }

  const scheduledTime = new Date(post.scheduledTime);
  const cronExpression = `${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${scheduledTime.getMonth() + 1} *`;

  const job = cron.schedule(cronExpression, async () => {
    try {
      await postToSocialMedia(post);
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'POSTED' },
      });
      console.log(`Post ${postId} published successfully`);
    } catch (error) {
      console.error(`Failed to publish post ${postId}:`, error);
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'FAILED' },
      });
    } finally {
      job.stop(); 
      scheduledJobs.delete(postId); 
    }
  });

  scheduledJobs.set(postId, job); 
  job.start(); 
}

module.exports = schedulePost;

const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { postToSocialMedia } = require('../socialMediaPoster');

const prisma = new PrismaClient();

async function schedulePost(postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { account: true },
  });

  if (!post) {
    console.error(`Post with id ${postId} not found`);
    return;
  }

  const scheduledTime = new Date(post.scheduledTime);
  const cronExpression = `${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${scheduledTime.getMonth() + 1} *`;

  cron.schedule(cronExpression, async () => {
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
    }
  });

  console.log(`Post ${postId} scheduled for ${scheduledTime}`);
}

module.exports = { schedulePost };
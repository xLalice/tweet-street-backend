const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cron = require('node-cron'); 
const postToSocialMedia = require("../utils/socialMediaPoster")

router.post('/schedule', async (req, res) => {
  const { accountId, content, scheduledTime, location } = req.body;

  try {
    const post = await prisma.post.create({
      data: {
        accountId,
        content,
        location, // Optional, can be null
        scheduledTime: new Date(scheduledTime),
        status: 'scheduled',
      },
    });

    schedulePost(post);

    res.status(201).json({ message: 'Post scheduled successfully', post });
  } catch (error) {
    console.error('Error scheduling post:', error);
    res.status(500).json({ message: 'Failed to schedule post', error });
  }
});

const schedulePost = (post) => {
  const now = new Date();

  if (post.scheduledTime > now) {
    const scheduledTime = new Date(post.scheduledTime);

    cron.schedule(`${scheduledTime.getMinutes()} ${scheduledTime.getHours()} ${scheduledTime.getDate()} ${scheduledTime.getMonth() + 1} *`, async () => {
      try {
        await postToSocialMedia(post);
        console.log('Post successfully published:', post.id);
      } catch (error) {
        console.error('Error posting to social media:', error);
      }
    });
  } else {
    postToSocialMedia(post);
  }
};

router.post('/post', async (req, res) => {
    const { accountId, content, location } = req.body;
  
    try {
      const post = await prisma.post.create({
        data: {
          accountId,
          content,
          location, 
          status: 'posted',
        },
      });
  
      await postToSocialMedia(post);
  
      res.status(201).json({ message: 'Post published successfully', post });
    } catch (error) {
      console.error('Error publishing post:', error);
      res.status(500).json({ message: 'Failed to publish post', error });
    }
  });
  
module.exports = router;

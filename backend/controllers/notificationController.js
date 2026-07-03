import {
  countUnreadJobNotifications,
  listJobNotifications,
  markAllJobNotificationsAsRead,
  markJobNotificationAsRead
} from "../src/db.js";

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

export function listNotifications(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const accountEmail = normalizeEmail(req.user?.email);

    return res.json({
      success: true,
      notifications: listJobNotifications(accountEmail, limit),
      unread_count: countUnreadJobNotifications(accountEmail)
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export function getUnreadNotificationCount(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);

    return res.json({
      success: true,
      unread_count: countUnreadJobNotifications(accountEmail)
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export function readNotification(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);
    const notification = markJobNotificationAsRead(req.params.id, accountEmail);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notificação não encontrada"
      });
    }

    return res.json({
      success: true,
      notification,
      unread_count: countUnreadJobNotifications(accountEmail)
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

export function readAllNotifications(req, res) {
  try {
    const accountEmail = normalizeEmail(req.user?.email);

    return res.json({
      success: true,
      unread_count: markAllJobNotificationsAsRead(accountEmail)
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

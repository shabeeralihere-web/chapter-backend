
import {
  sendWelcomeEmail,
} from "./nodemailer.js";

try {
  await sendWelcomeEmail(
    "test@example.com",
    "Welcome to Chapter. — Test Email",
    "welcome_mail_template",
    {
      name: "Book Store Tester",
    }
  );

  console.log("Test email sent successfully!");
} catch (error) {
  console.error("Test email failed:", error.message);
  process.exitCode = 1;
}

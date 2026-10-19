
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve templates relative to this file's project structure.
const viewsPath = path.resolve(__dirname, "../../views");

const fromEmail = process.env.EMAIL_USER;
const port = Number(process.env.MAIL_TRAP_PORT);

const transport = nodemailer.createTransport({
  host: process.env.MAIL_TRAP_HOST,
  port,
  secure: port === 465,
  auth: {
    user: process.env.MAIL_TRAP_USER,
    pass: process.env.MAIL_TRAP_PASS,
  },
});

const handlebarOptions = {
  viewEngine: {
    extname: ".handlebars",
    partialsDir: viewsPath,
    defaultLayout: false,
  },
  viewPath: viewsPath,
  extName: ".handlebars",
};

transport.use("compile", hbs(handlebarOptions));

const sendEmail = async (to, subject, template, context = {}) => {
  if (!fromEmail) {
    throw new Error("EMAIL_USER is missing from environment variables");
  }

  const mailOptions = {
    from: `"Readify" <${fromEmail}>`,
    to,
    subject,
    template,
    context,
  };

  try {
    return await transport.sendMail(mailOptions);
  } catch (error) {
    console.error("Failed to send email:", error.message);
    throw error;
  }
};

export const sendWelcomeEmail = (to, subject, template, context) =>
  sendEmail(to, subject, template, context);

export const sendBlockUnblockEmail = (
  to,
  subject,
  template,
  context,
  blocked
) => sendEmail(to, subject, template, context);

export const sendDeletUserEmail = (to, subject, template, context) =>
  sendEmail(to, subject, template, context);

export const sendDeleteBookEmail = (to, subject, template, context) =>
  sendEmail(to, subject, template, context);

export const verifyEmailTransport = () => transport.verify();

const nodemailer = require('nodemailer');

const isEmailConfigured = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
};

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailConfigured()) {
    console.warn('Email not configured. Skipping email send.');
    return false;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
  return true;
};

const buildSignature = () => {
  return [
    '',
    'Best regards,',
    'Habit AI Team',
    '',
    'This Email "Workwithhussnainahmad@gmail.com" is under developer/owner\'s custody, any Question/Query feel free to mail.',
    'This is not a Business Email, So Please Dont Spam it, Thanks For Understanding.',
  ].join('\n');
};

const buildHtmlSignature = () => `
  <p>Best regards,<br/>Habit AI Team</p>
  <p style="font-size:12px;color:#666;">
    This Email "Workwithhussnainahmad@gmail.com" is under developer/owner's custody, any Question/Query feel free to mail.<br/>
    This is not a Business Email, So Please Dont Spam it, Thanks For Understanding.
  </p>
`;

const sendWelcomeEmail = async (email, name) => {
  const safeName = name || 'there';
  const subject = 'Welcome to Habit AI';
  const text = [
    `Hi ${safeName},`,
    '',
    'Welcome to Habit AI. Your account has been created successfully.',
    'You can now set goals, track daily progress, and receive personalized guidance.',
    '',
    'To get started:',
    '1. Create your first habit with a clear goal and schedule.',
    '2. Log your daily progress.',
    '3. Open AI Coach for daily suggestions.',
    '',
    'If you did not create this account, please reply to this email.',
    buildSignature(),
  ].join('\n');
  const html = `
    <p>Hi ${safeName},</p>
    <p>Welcome to Habit AI. Your account has been created successfully.</p>
    <p>You can now set goals, track daily progress, and receive personalized guidance.</p>
    <p><strong>To get started:</strong></p>
    <ol>
      <li>Create your first habit with a clear goal and schedule.</li>
      <li>Log your daily progress.</li>
      <li>Open AI Coach for daily suggestions.</li>
    </ol>
    <p>If you did not create this account, please reply to this email.</p>
    ${buildHtmlSignature()}
  `;
  return sendEmail({ to: email, subject, text, html });
};

const sendPasswordResetEmail = async (email, code) => {
  const subject = 'Your Habit AI password reset code';
  const text = [
    'We received a request to reset your Habit AI password.',
    '',
    `Your verification code is: ${code}`,
    '',
    'This code expires in 15 minutes.',
    'If you did not request a password reset, you can safely ignore this email.',
    buildSignature(),
  ].join('\n');
  const html = `
    <p>We received a request to reset your Habit AI password.</p>
    <p><strong>Your verification code is: ${code}</strong></p>
    <p>This code expires in 15 minutes.</p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
    ${buildHtmlSignature()}
  `;
  return sendEmail({ to: email, subject, text, html });
};

const sendPasswordResetConfirmationEmail = async (email) => {
  const subject = 'Your Habit AI password was reset';
  const text = [
    'This is a confirmation that your Habit AI password was changed successfully.',
    '',
    'If you did not perform this change, please reset your password immediately and secure your account.',
    buildSignature(),
  ].join('\n');
  const html = `
    <p>This is a confirmation that your Habit AI password was changed successfully.</p>
    <p>If you did not perform this change, please reset your password immediately and secure your account.</p>
    ${buildHtmlSignature()}
  `;
  return sendEmail({ to: email, subject, text, html });
};

const sendPasswordChangedEmail = async (email) => {
  const subject = 'Your Habit AI password was updated';
  const text = [
    'This is a confirmation that your Habit AI password was updated from your profile settings.',
    '',
    'If you did not perform this action, please reset your password immediately and secure your account.',
    buildSignature(),
  ].join('\n');
  const html = `
    <p>This is a confirmation that your Habit AI password was updated from your profile settings.</p>
    <p>If you did not perform this action, please reset your password immediately and secure your account.</p>
    ${buildHtmlSignature()}
  `;
  return sendEmail({ to: email, subject, text, html });
};

const sendAccountDeletedEmail = async (email) => {
  const subject = 'Your Habit AI account was deleted';
  const text = [
    'This is a confirmation that your Habit AI account and related data were deleted.',
    '',
    'If you did not request this action, please contact support immediately.',
    buildSignature(),
  ].join('\n');
  const html = `
    <p>This is a confirmation that your Habit AI account and related data were deleted.</p>
    <p>If you did not request this action, please contact support immediately.</p>
    ${buildHtmlSignature()}
  `;
  return sendEmail({ to: email, subject, text, html });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetConfirmationEmail,
  sendPasswordChangedEmail,
  sendAccountDeletedEmail,
  isEmailConfigured,
};

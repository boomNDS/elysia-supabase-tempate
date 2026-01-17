import { render } from "@react-email/render";
import React from "react";
import { Resend } from "resend";

import { appConfig } from "../config";
import WelcomeEmail from "../emails/WelcomeEmail";
import { appLogger } from "../lib/logger";

const resendApiKey = appConfig.resendApiKey;
const emailFrom = appConfig.emailFrom;

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const sendWelcomeEmail = async (to: string, name?: string) => {
	if (!resend) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	const html = await render(<WelcomeEmail name={name} />);

	const { error } = await resend.emails.send({
		from: emailFrom,
		to,
		subject: `Welcome${name ? `, ${name}` : ""}!`,
		html,
	});

	if (error) {
		appLogger.error(`Failed to send email: ${error.message}`, "Email");
		throw new Error(error.message);
	}

	appLogger.log(`Sent welcome email to ${to}`, "Email");
};

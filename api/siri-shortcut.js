// Vercel serverless function - generates a personalised .shortcut file for the user
// GET /api/siri-shortcut?token=USER_SIRI_TOKEN
//
// iOS opens the downloaded file directly in the Shortcuts app.
// The shortcut has the user's token pre-embedded - zero manual setup required.
// Users only need "Allow Untrusted Shortcuts" enabled once in iOS Settings > Shortcuts.
//
// Required env vars: SIRI_TOKEN_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createHmac } from "crypto";

// Fixed UUID for the Ask action - stable across all generated shortcuts
const ASK_UUID = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildShortcutPlist(token, appUrl) {
  const safeToken = xmlEscape(token);
  const safeUrl = xmlEscape(`${appUrl}/api/siri-add`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>WFWorkflowClientVersion</key>
	<string>1250.0.0</string>
	<key>WFWorkflowHasShortcutInputVariables</key>
	<false/>
	<key>WFWorkflowIcon</key>
	<dict>
		<key>WFWorkflowIconGlyphNumber</key>
		<integer>59511</integer>
		<key>WFWorkflowIconStartColor</key>
		<integer>-2170107905</integer>
	</dict>
	<key>WFWorkflowImportQuestions</key>
	<array/>
	<key>WFWorkflowMinimumClientVersion</key>
	<integer>900</integer>
	<key>WFWorkflowMinimumClientVersionString</key>
	<string>900</string>
	<key>WFWorkflowName</key>
	<string>Add to Do-Do</string>
	<key>WFWorkflowNoInputBehavior</key>
	<dict>
		<key>Name</key>
		<string>WFWorkflowNoInputBehaviorAskForInput</string>
		<key>Parameters</key>
		<dict>
			<key>ActionIdentifier</key>
			<string>is.workflow.actions.ask</string>
		</dict>
	</dict>
	<key>WFWorkflowOutputContentItemClasses</key>
	<array/>
	<key>WFWorkflowTypes</key>
	<array>
		<string>NCWidget</string>
		<string>WatchKit</string>
	</array>
	<key>WFWorkflowActions</key>
	<array>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.ask</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFAskActionPrompt</key>
				<string>What needs to be done?</string>
				<key>WFInputType</key>
				<string>Text</string>
				<key>CustomOutputName</key>
				<string>Task</string>
				<key>UUID</key>
				<string>${ASK_UUID}</string>
			</dict>
		</dict>
		<dict>
			<key>WFWorkflowActionIdentifier</key>
			<string>is.workflow.actions.downloadurl</string>
			<key>WFWorkflowActionParameters</key>
			<dict>
				<key>WFHTTPMethod</key>
				<string>POST</string>
				<key>WFURL</key>
				<string>${safeUrl}</string>
				<key>WFHTTPBodyType</key>
				<string>JSON</string>
				<key>WFJSONValues</key>
				<dict>
					<key>Value</key>
					<dict>
						<key>WFDictionaryFieldValueItems</key>
						<array>
							<dict>
								<key>WFItemType</key>
								<integer>0</integer>
								<key>WFKey</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>title</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>attachmentsByRange</key>
										<dict>
											<key>{0, 1}</key>
											<dict>
												<key>OutputName</key>
												<string>Task</string>
												<key>OutputUUID</key>
												<string>${ASK_UUID}</string>
												<key>Type</key>
												<string>ActionOutput</string>
											</dict>
										</dict>
										<key>string</key>
										<string>&#xFFFC;</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
							</dict>
							<dict>
								<key>WFItemType</key>
								<integer>0</integer>
								<key>WFKey</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>token</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
								<key>WFValue</key>
								<dict>
									<key>Value</key>
									<dict>
										<key>string</key>
										<string>${safeToken}</string>
									</dict>
									<key>WFSerializationType</key>
									<string>WFTextTokenString</string>
								</dict>
							</dict>
						</array>
					</dict>
					<key>WFSerializationType</key>
					<string>WFDictionaryFieldValue</string>
				</dict>
			</dict>
		</dict>
	</array>
</dict>
</plist>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const { token } = req.query || {};
  if (!token) return res.status(400).send("token param required");

  const tokenSecret = process.env.SIRI_TOKEN_SECRET;
  if (!tokenSecret) return res.status(500).send("Server not configured");

  // Validate token
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return res.status(401).send("Invalid token");

  const userId = token.slice(0, dotIdx);
  const providedHmac = token.slice(dotIdx + 1);
  const expectedHmac = createHmac("sha256", tokenSecret).update(userId).digest("hex").slice(0, 32);

  if (providedHmac !== expectedHmac) return res.status(401).send("Invalid token");

  // Derive app base URL from request
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const appUrl = `${proto}://${host}`;

  const plist = buildShortcutPlist(token, appUrl);

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="Add to Do-Do.shortcut"');
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).send(plist);
}

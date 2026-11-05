/**
 * FlowMancer mail relay (Google Apps Script).
 *
 * Lets the FlowMancer server send email from this Gmail account over HTTPS. Use it when the
 * server's host blocks email ports (Render's free plan blocks SMTP ports 25, 465 and 587).
 * It sends password-reset links and the replies you approve with "Send now".
 *
 * Set it up in the Gmail account that FlowMancer reads (IMAP_USER); see the README section
 * "Sending email on Render's free plan". Gmail allows about 100 recipients a day from scripts.
 */

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return answer_({ ok: false, error: 'Bad request' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || secret.length < 32 || data.secret !== secret) {
    return answer_({ ok: false, error: 'Wrong secret' });
  }
  if (!data.to || !data.subject || !data.text) {
    return answer_({ ok: false, error: 'to, subject and text are required' });
  }
  var options = { name: data.name || 'FlowMancer' };
  if (data.html) options.htmlBody = data.html;
  try {
    var original = data.in_reply_to ? findMessage_(data.in_reply_to) : null;
    if (original && original.getFrom().toLowerCase().indexOf(String(data.to).toLowerCase()) !== -1) {
      original.reply(data.text, options); // keeps the reply in the customer's conversation
    } else {
      GmailApp.sendEmail(data.to, data.subject, data.text, options);
    }
    return answer_({ ok: true });
  } catch (err) {
    return answer_({ ok: false, error: String(err) });
  }
}

/** Run this once from the editor to give the script permission to send as you. */
function authorize() {
  GmailApp.getInboxUnreadCount();
}

function findMessage_(messageId) {
  var id = String(messageId).replace(/[<>]/g, '');
  var threads = GmailApp.search('rfc822msgid:' + id, 0, 1);
  if (!threads.length) return null;
  var messages = threads[0].getMessages();
  for (var i = messages.length - 1; i >= 0; i--) {
    if (String(messages[i].getHeader('Message-ID')).replace(/[<>]/g, '') === id) return messages[i];
  }
  return null;
}

function answer_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

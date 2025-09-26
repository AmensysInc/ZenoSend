import React, { useEffect, useMemo, useState } from 'react';
import { composeSend, getContacts } from '../api'; // <-- your real API module
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Send, Mail, Users, AlertCircle } from 'lucide-react';
import { toast } from '../hooks/use-toast';

/**
 * If you don't already have a MultiSelect component, see section 2 below
 * for a minimal version. Otherwise import your existing one like:
 *   import { MultiSelect } from '@/components/ui/multi-select';
 */
import { MultiSelect } from './ui/multi-select';

type Contact = {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    status: string;
    reason?: string | null;
    provider?: string | null;
};

export default function ComposeCampaign() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);

    const [fromEmail, setFromEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [textBody, setTextBody] = useState('');
    const [htmlBody, setHtmlBody] = useState('');

    const [toIds, setToIds] = useState<number[]>([]);
    const [ccIds, setCcIds] = useState<number[]>([]);
    const [bccIds, setBccIds] = useState<number[]>([]);

    const [toExtra, setToExtra] = useState('');
    const [ccExtra, setCcExtra] = useState('');
    const [bccExtra, setBccExtra] = useState('');
    const [validateExtras, setValidateExtras] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                // Pull only valid contacts for the pickers (matches your backend)
                const rows = (await getContacts('valid')) as Contact[];
                setContacts(rows);
            } catch (e: any) {
                setError(e.message ?? 'Failed to load contacts');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const contactOptions = useMemo(
        () =>
            contacts.map((c) => ({
                label: c.email,
                value: c.id,
                subtitle:
                    [c.first_name, c.last_name].filter(Boolean).join(' ') || undefined,
            })),
        [contacts]
    );

    function parseExtras(s: string): string[] {
        return s.split(/[,\s;]+/).map((x) => x.trim()).filter(Boolean);
    }

    async function onSend(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSending(true);

        try {
            if (!fromEmail || !subject) {
                setError('From and Subject are required');
                return;
            }

            const payload = {
                name: 'Quick Send',
                from_email: fromEmail,
                subject,
                text_body: textBody || undefined,
                html_body: htmlBody || undefined,
                to_ids: toIds,
                cc_ids: ccIds,
                bcc_ids: bccIds,
                to_extra: parseExtras(toExtra),
                cc_extra: parseExtras(ccExtra),
                bcc_extra: parseExtras(bccExtra),
                validate_extras: validateExtras,
            };

            const r = await composeSend(payload);

            toast({
                title: 'Campaign Sent',
                description: `Campaign ${r.campaign_id} — Selected: ${r.selected}, Valid: ${r.valid_recipients}, Enqueued: ${r.enqueued}`,
            });

            // reset form
            setFromEmail('');
            setSubject('');
            setTextBody('');
            setHtmlBody('');
            setToIds([]);
            setCcIds([]);
            setBccIds([]);
            setToExtra('');
            setCcExtra('');
            setBccExtra('');
        } catch (e: any) {
            const msg = e?.message ?? 'Failed to send';
            setError(msg);
            toast({ title: 'Error', description: msg, variant: 'destructive' });
        } finally {
            setSending(false);
        }
    }

    const extrasCount =
        parseExtras(toExtra).length +
        parseExtras(ccExtra).length +
        parseExtras(bccExtra).length;

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    <span className="text-muted-foreground">Loading contacts...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="bg-email-header border-b border-border px-6 py-4">
                <div className="flex items-center space-x-2">
                    <Mail className="h-6 w-6 text-primary" />
                    <h1 className="text-2xl font-semibold text-foreground">Compose Campaign</h1>
                </div>
            </div>

            <div className="container mx-auto px-6 py-8 max-w-6xl">
                <Card className="shadow-elegant bg-gradient-card border-border">
                    <CardHeader className="pb-6">
                        <CardTitle className="flex items-center space-x-2">
                            <Users className="h-5 w-5 text-primary" />
                            <span>New Email Campaign</span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={onSend} className="space-y-6">
                            {/* From + Subject */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="from" className="text-sm font-medium">From</Label>
                                    <Input
                                        id="from"
                                        type="email"
                                        placeholder="you@company.com"
                                        value={fromEmail}
                                        onChange={(e) => setFromEmail(e.target.value)}
                                        required
                                        className="bg-input border-input-border focus:border-primary shadow-input"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                                    <Input
                                        id="subject"
                                        placeholder="Enter email subject"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        required
                                        className="bg-input border-input-border focus:border-primary shadow-input"
                                    />
                                </div>
                            </div>

                            <Separator className="bg-border" />

                            {/* Recipients */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium flex items-center space-x-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    <span>Recipients</span>
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* To */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">To (Valid Contacts)</Label>
                                        <MultiSelect
                                            options={contactOptions}
                                            selected={toIds}
                                            onSelectedChange={setToIds}
                                            placeholder="Select recipients..."
                                        />
                                        <div className="space-y-2">
                                            <Label htmlFor="to-extra" className="text-xs text-muted-foreground">
                                                Add Additional To Emails
                                            </Label>
                                            <Input
                                                id="to-extra"
                                                placeholder="email1@example.com, email2@example.com"
                                                value={toExtra}
                                                onChange={(e) => setToExtra(e.target.value)}
                                                className="bg-input border-input-border text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* CC */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">CC (Valid Contacts)</Label>
                                        <MultiSelect
                                            options={contactOptions}
                                            selected={ccIds}
                                            onSelectedChange={setCcIds}
                                            placeholder="Select CC recipients..."
                                        />
                                        <div className="space-y-2">
                                            <Label htmlFor="cc-extra" className="text-xs text-muted-foreground">
                                                Add Additional CC Emails
                                            </Label>
                                            <Input
                                                id="cc-extra"
                                                placeholder="cc1@example.com, cc2@example.com"
                                                value={ccExtra}
                                                onChange={(e) => setCcExtra(e.target.value)}
                                                className="bg-input border-input-border text-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* BCC */}
                                    <div className="space-y-3">
                                        <Label className="text-sm font-medium">BCC (Valid Contacts)</Label>
                                        <MultiSelect
                                            options={contactOptions}
                                            selected={bccIds}
                                            onSelectedChange={setBccIds}
                                            placeholder="Select BCC recipients..."
                                        />
                                        <div className="space-y-2">
                                            <Label htmlFor="bcc-extra" className="text-xs text-muted-foreground">
                                                Add Additional BCC Emails
                                            </Label>
                                            <Input
                                                id="bcc-extra"
                                                placeholder="bcc1@example.com, bcc2@example.com"
                                                value={bccExtra}
                                                onChange={(e) => setBccExtra(e.target.value)}
                                                className="bg-input border-input-border text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="validate"
                                        checked={validateExtras}
                                        onCheckedChange={(checked) => setValidateExtras(Boolean(checked))}
                                    />
                                    <Label htmlFor="validate" className="text-sm text-muted-foreground cursor-pointer">
                                        Validate typed emails before sending
                                    </Label>
                                </div>
                            </div>

                            <Separator className="bg-border" />

                            {/* Message */}
                            <div className="space-y-6">
                                <h3 className="text-lg font-medium flex items-center space-x-2">
                                    <Mail className="h-5 w-5 text-primary" />
                                    <span>Message</span>
                                </h3>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="text-body" className="text-sm font-medium">Plain Text</Label>
                                        <Textarea
                                            id="text-body"
                                            placeholder="Enter your message here..."
                                            value={textBody}
                                            onChange={(e) => setTextBody(e.target.value)}
                                            rows={10}
                                            className="bg-input border-input-border focus:border-primary shadow-input resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="html-body" className="text-sm font-medium">HTML (Optional)</Label>
                                        <Textarea
                                            id="html-body"
                                            placeholder="<p>Enter HTML content here...</p>"
                                            value={htmlBody}
                                            onChange={(e) => setHtmlBody(e.target.value)}
                                            rows={10}
                                            className="bg-input border-input-border focus:border-primary shadow-input resize-none font-mono text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="flex items-center space-x-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                    <span className="text-destructive text-sm">{error}</span>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex justify-between items-center pt-6">
                                <div className="text-sm text-muted-foreground">
                                    Total recipients: {toIds.length + ccIds.length + bccIds.length + extrasCount}
                                </div>
                                <Button
                                    type="submit"
                                    disabled={sending || !fromEmail || !subject}
                                    className="bg-gradient-primary hover:bg-primary-hover text-primary-foreground px-8 py-2 font-medium shadow-elegant"
                                >
                                    {sending ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="h-4 w-4 mr-2" />
                                            Send Campaign
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

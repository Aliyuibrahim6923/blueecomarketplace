import { Button } from "@/components/ui/button";

type Contact = { contact_phone: string | null; contact_email: string | null; whatsapp: string | null };

/** Direct-contact buttons for the login-free market (only details the seller made public). */
export function ContactButtons({ contact, productName, businessName }: { contact: Contact | null | undefined; productName: string; businessName: string }) {
  const hasAny = !!contact && !!(contact.contact_phone || contact.whatsapp || contact.contact_email);
  if (!hasAny) {
    return (
      <p className="text-sm text-muted-foreground">
        {businessName} has not published contact details. Check back later or browse other listings.
      </p>
    );
  }
  const message = `Hello ${businessName}, I saw your listing "${productName}" on BlueMarket Nigeria. Is it still available?`;
  const waDigits = contact.whatsapp?.replace(/\D/g, "");
  return (
    <div className="flex flex-wrap gap-2">
      {waDigits ? (
        <Button asChild variant="teal">
          <a href={`https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            WhatsApp seller
          </a>
        </Button>
      ) : null}
      {contact.contact_phone ? (
        <Button asChild>
          <a href={`tel:${contact.contact_phone}`}>Call {contact.contact_phone}</a>
        </Button>
      ) : null}
      {contact.contact_email ? (
        <Button asChild variant="outline">
          <a href={`mailto:${contact.contact_email}?subject=${encodeURIComponent(`Enquiry: ${productName}`)}&body=${encodeURIComponent(message)}`}>
            Email seller
          </a>
        </Button>
      ) : null}
    </div>
  );
}

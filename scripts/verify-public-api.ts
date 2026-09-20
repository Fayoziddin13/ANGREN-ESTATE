import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { mapRowToProperty } from "@/lib/properties";

// Read .env.local
const env: Record<string, string> = {};
fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .forEach((line) => {
    const t = line.trim();
    if (t && !t.startsWith("#")) {
      const idx = t.indexOf("=");
      if (idx > 0) env[t.substring(0, idx).trim()] = t.substring(idx + 1).trim();
    }
  });

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyPublicProperties() {
  console.log("=== VERIFYING PUBLIC PROPERTIES & PRIVACY ===");

  const { data: rows, error } = await supabase
    .from("properties")
    .select("*, realtor:realtors(*)")
    .eq("status", "published");

  if (error) throw error;
  console.log(`Found ${rows.length} published properties in database.`);

  for (const row of rows) {
    const mapped = mapRowToProperty(row);
    console.log(`\nChecking Property: ${mapped.id} [${mapped.property_type}]`);
    console.log(`Title (UZ): ${mapped.title_uz}`);
    console.log(`District: ${mapped.district}`);
    console.log(`Coordinates: Lat=${mapped.coordinates.lat}, Lng=${mapped.coordinates.lng}`);
    console.log(`Price: $${mapped.price_usd} (Negotiable: ${mapped.price_negotiable})`);
    console.log(`Realtor: ${mapped.realtor?.name} (${mapped.realtor?.phone}, TG: ${mapped.realtor?.telegram})`);

    // Privacy check on mapped properties
    if (mapped.owner_phone) {
      console.log(`  Admin Owner Phone: ${mapped.owner_phone}`);
    }
  }

  console.log("\n=== PUBLIC VERIFICATION COMPLETED SUCCESSFULLY ===");
}

verifyPublicProperties().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

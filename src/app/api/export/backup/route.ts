import { NextResponse } from "next/server";
import { localDateKey } from "@/lib/dates";
import {
  accountSettingsCollection,
  accountTransactionsCollection,
  badgeUnlocksCollection,
  checklistCompletionsCollection,
  checklistItemsCollection,
  moodTagsCollection,
  reflectionsCollection,
  rulesCollection,
  setupTagsCollection,
  tradeImagesCollection,
  tradesCollection,
} from "@/server/firebase/collections";

/** Full JSON dump of every Firestore collection — the Firestore-era
 * replacement for the old raw-SQLite-file backup download, which has no
 * equivalent once the data no longer lives in a single local file. */
export async function GET() {
  const [
    rules,
    setupTags,
    moodTags,
    trades,
    badgeUnlocks,
    checklistItems,
    accountSettings,
    accountTransactions,
    checklistCompletions,
    reflections,
  ] = await Promise.all([
    rulesCollection().get(),
    setupTagsCollection().get(),
    moodTagsCollection().get(),
    tradesCollection().get(),
    badgeUnlocksCollection().get(),
    checklistItemsCollection().get(),
    accountSettingsCollection().get(),
    accountTransactionsCollection().get(),
    checklistCompletionsCollection().get(),
    reflectionsCollection().get(),
  ]);

  const tradesWithImages = await Promise.all(
    trades.docs.map(async (doc) => {
      const images = await tradeImagesCollection(doc.id).get();
      return { ...doc.data(), images: images.docs.map((d) => d.data()) };
    }),
  );

  const backup = {
    exportedAt: new Date().toISOString(),
    rules: rules.docs.map((d) => d.data()),
    setupTags: setupTags.docs.map((d) => d.data()),
    moodTags: moodTags.docs.map((d) => d.data()),
    trades: tradesWithImages,
    badgeUnlocks: badgeUnlocks.docs.map((d) => d.data()),
    checklistItems: checklistItems.docs.map((d) => d.data()),
    accountSettings: accountSettings.docs.map((d) => d.data()),
    accountTransactions: accountTransactions.docs.map((d) => d.data()),
    checklistCompletions: checklistCompletions.docs.map((d) => d.data()),
    reflections: reflections.docs.map((d) => d.data()),
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="trading-journal-backup-${localDateKey()}.json"`,
    },
  });
}

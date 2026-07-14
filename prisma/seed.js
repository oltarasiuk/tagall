import { PrismaClient } from "@prisma/client";
import { seedsData } from "./seedsData.js";
const prisma = new PrismaClient();

async function main() {
  const { collections, fieldGroups } = seedsData;
  for (const collection of collections) {
    try {
      await prisma.collection.upsert({
        where: {
          id: collection.id,
        },
        create: {
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          priority: collection.priority,
        },
        update: {
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          priority: collection.priority,
        },
      });
    } catch (error) {
      console.log({ collection, error });
    }
  }
  for (const fieldGroup of fieldGroups) {
    try {
      await prisma.fieldGroup.upsert({
        where: {
          id: fieldGroup.id,
        },
        create: {
          id: fieldGroup.id,
          name: fieldGroup.name,
          priority: fieldGroup.priority,
          isFiltering: fieldGroup.isFiltering,
          collections: {
            connect: fieldGroup.collections.map((collectionId) => ({
              id: collectionId,
            })),
          },
        },
        update: {
          name: fieldGroup.name,
          priority: fieldGroup.priority,
          isFiltering: fieldGroup.isFiltering,
          collections: {
            connect: fieldGroup.collections.map((collectionId) => ({
              id: collectionId,
            })),
          },
        },
      });
    } catch (error) {
      console.log({ fieldGroup, error });
    }
  }
}

console.log("Seeding database...");
main()
  .then(async () => {
    console.log("Seed data inserted successfully.");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient() as InstanceType<typeof PrismaClient>;

async function main() {
  console.log("🌱 Seeding database...");

  // ──────────────────────────────────────────────
  // 1. Utilisateur de test
  // ──────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { clerkId: "test_user_123" },
    update: {},
    create: {
      clerkId: "test_user_123",
      email: "test@example.com",
      name: "Test User",
      plan: "PRO",
      creditsUsed: 42,
      creditsLimit: 500,
      locale: "fr",
    },
  });
  console.log(`✅ User créé : ${user.name} (${user.email})`);

  // ──────────────────────────────────────────────
  // 2. Influenceuses de test
  // ──────────────────────────────────────────────
  const influencersData = [
    {
      name: "Luna Fit",
      slug: "luna-fit",
      bio: "Coach fitness et lifestyle, passionnée par le bien-être et la nutrition. Je partage mes entraînements et mes recettes healthy au quotidien.",
      personality:
        "Énergique, motivante, bienveillante. Parle avec enthousiasme et utilise beaucoup d'émojis sportifs. Encourage toujours ses abonnés.",
      niche: "FITNESS" as const,
      age: 24,
      style: {
        ethnicity: "caucasian",
        hairColor: "blonde",
        hairStyle: "ponytail",
        bodyType: "athletic",
        fashionStyle: "sporty",
      },
      isNsfw: false,
      status: "ACTIVE" as const,
    },
    {
      name: "Jade Travel",
      slug: "jade-travel",
      bio: "Digital nomade et exploratrice du monde. Je documente mes voyages à travers les plus beaux endroits de la planète.",
      personality:
        "Aventurière, curieuse, inspirante. Écrit de façon poétique avec des descriptions détaillées des lieux visités. Partage des conseils pratiques.",
      niche: "TRAVEL" as const,
      age: 27,
      style: {
        ethnicity: "asian",
        hairColor: "black",
        hairStyle: "long-straight",
        bodyType: "slim",
        fashionStyle: "bohemian",
      },
      isNsfw: false,
      status: "ACTIVE" as const,
    },
    {
      name: "Mia Style",
      slug: "mia-style",
      bio: "Icône de mode et tendances. Je crée du contenu mode audacieux et avant-gardiste pour celles qui osent être différentes.",
      personality:
        "Confiante, provocante, créative. Utilise un ton direct et fashion-forward. Aime les marques de luxe et les pièces uniques.",
      niche: "FASHION" as const,
      age: 22,
      style: {
        ethnicity: "latina",
        hairColor: "brunette",
        hairStyle: "wavy",
        bodyType: "curvy",
        fashionStyle: "high-fashion",
      },
      isNsfw: true,
      status: "PAUSED" as const,
    },
  ];

  const influencers = [];

  for (const data of influencersData) {
    const influencer = await prisma.influencer.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        userId: user.id,
        ...data,
      },
    });
    influencers.push(influencer);
    console.log(
      `✅ Influenceuse créée : ${influencer.name} (${influencer.niche}, ${influencer.age} ans)`
    );
  }

  // ──────────────────────────────────────────────
  // 3. Comptes sociaux (Instagram + TikTok pour chaque)
  // ──────────────────────────────────────────────
  for (const influencer of influencers) {
    const slug = influencer.slug.replace("-", "");

    await prisma.socialAccount.upsert({
      where: {
        influencerId_platform: {
          influencerId: influencer.id,
          platform: "INSTAGRAM",
        },
      },
      update: {},
      create: {
        influencerId: influencer.id,
        platform: "INSTAGRAM",
        username: `@${slug}`,
        isConnected: true,
        followers: Math.floor(Math.random() * 50000) + 10000,
      },
    });

    await prisma.socialAccount.upsert({
      where: {
        influencerId_platform: {
          influencerId: influencer.id,
          platform: "TIKTOK",
        },
      },
      update: {},
      create: {
        influencerId: influencer.id,
        platform: "TIKTOK",
        username: `@${slug}`,
        isConnected: true,
        followers: Math.floor(Math.random() * 80000) + 5000,
      },
    });

    console.log(
      `✅ Comptes sociaux créés pour ${influencer.name} (Instagram + TikTok)`
    );
  }

  // ──────────────────────────────────────────────
  // 4. Contenus de test (PHOTO, READY)
  // ──────────────────────────────────────────────
  const contentTemplates = [
    {
      caption:
        "Morning workout vibes 💪 Rien de mieux qu'une séance matinale pour bien démarrer la journée ! #fitness #motivation #workout",
      hashtags: ["fitness", "motivation", "workout", "healthy", "gym"],
    },
    {
      caption:
        "Sunset over Bali 🌅 Les couchers de soleil ici sont absolument magiques. Chaque soir est un spectacle différent.",
      hashtags: ["travel", "bali", "sunset", "wanderlust", "explore"],
    },
    {
      caption:
        "New collection drop 🔥 Cette robe est absolument incroyable. Lien en bio pour shopper le look !",
      hashtags: ["fashion", "style", "ootd", "newcollection", "luxury"],
    },
    {
      caption:
        "Smoothie bowl du jour 🥣 Recette : banane, myrtilles, granola maison et graines de chia. Un délice !",
      hashtags: ["healthy", "smoothiebowl", "nutrition", "fitfood", "wellness"],
    },
    {
      caption:
        "Exploring hidden temples 🏯 Ce temple secret au cœur de Kyoto est un véritable joyau caché.",
      hashtags: ["japan", "kyoto", "temple", "hiddenplaces", "travel"],
    },
    {
      caption:
        "Street style Paris 🇫🇷 Le trench coat revisité avec une touche moderne. La mode c'est l'art de se réinventer.",
      hashtags: ["paris", "streetstyle", "fashion", "trenchcoat", "chic"],
    },
  ];

  for (let i = 0; i < influencers.length; i++) {
    const influencer = influencers[i];
    // Chaque influenceuse reçoit 2 contenus
    for (let j = 0; j < 2; j++) {
      const template = contentTemplates[i * 2 + j];
      await prisma.content.create({
        data: {
          influencerId: influencer.id,
          type: "PHOTO",
          contentMode: influencer.isNsfw ? "NSFW" : "SFW",
          status: "READY",
          caption: template.caption,
          hashtags: template.hashtags,
          mediaUrls: [
            `https://placehold.co/1080x1350/8b5cf6/white?text=${encodeURIComponent(influencer.name)}+Photo+${j + 1}`,
          ],
          thumbnailUrl: `https://placehold.co/400x400/8b5cf6/white?text=${encodeURIComponent(influencer.name)}`,
          promptUsed: `Professional photo of ${influencer.name}, ${influencer.niche.toLowerCase()} influencer, high quality, 4k`,
          platforms: ["INSTAGRAM", "TIKTOK"],
        },
      });
    }
    console.log(
      `✅ 2 contenus créés pour ${influencer.name}`
    );
  }

  // ──────────────────────────────────────────────
  // 5. InfluencerAnalytics avec données réalistes
  // ──────────────────────────────────────────────
  const analyticsData = [
    {
      totalContents: 47,
      totalViews: 284300,
      totalLikes: 18750,
      avgEngagement: 6.59,
      estimatedRevenue: 1245.0,
    },
    {
      totalContents: 63,
      totalViews: 512800,
      totalLikes: 34200,
      avgEngagement: 6.67,
      estimatedRevenue: 2890.5,
    },
    {
      totalContents: 21,
      totalViews: 98400,
      totalLikes: 7800,
      avgEngagement: 7.93,
      estimatedRevenue: 456.0,
    },
  ];

  for (let i = 0; i < influencers.length; i++) {
    await prisma.influencerAnalytics.upsert({
      where: { influencerId: influencers[i].id },
      update: analyticsData[i],
      create: {
        influencerId: influencers[i].id,
        ...analyticsData[i],
      },
    });
    console.log(
      `✅ Analytics créées pour ${influencers[i].name} (${analyticsData[i].totalViews.toLocaleString()} vues)`
    );
  }

  console.log("\n🎉 Seed terminé avec succès !");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Erreur lors du seed :", e);
    await prisma.$disconnect();
    process.exit(1);
  });


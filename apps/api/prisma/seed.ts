/**
 * Demo data for local development: an admin, a buyer and three fictional
 * partners in central Bishkek with schedules for every day of the week.
 *
 *   Admin:   +996700000001
 *   Owner:   +996700000002 (Нан-Ай), +996700000003 (Tóo Coffee), +996700000004 (Ашкана №1)
 *   Staff:   +996700000005 (Нан-Ай, Ахунбаева)
 *   Buyer:   +996700000010
 *
 * Log in with any of these phones; in development the OTP code is shown in the app.
 */
import { PrismaClient } from '@prisma/client';
import { generateScheduledOffers } from '../src/services/offers.js';

const prisma = new PrismaClient();
const everyDay = [1, 2, 3, 4, 5, 6, 7];

async function main() {
  await prisma.user.upsert({
    where: { phone: '+996700000001' },
    create: { phone: '+996700000001', name: 'Администратор', role: 'ADMIN' },
    update: { role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { phone: '+996700000010' },
    create: { phone: '+996700000010', name: 'Айгерим' },
    update: {},
  });

  const partners = [
    {
      ownerPhone: '+996700000002',
      ownerName: 'Нурлан',
      brandName: 'Пекарня Нан-Ай',
      legalName: 'ОсОО «Нан-Ай»',
      inn: '01234567890123',
      category: 'BAKERY' as const,
      locations: [
        { name: 'Нан-Ай на Чуй', address: 'пр. Чуй, 150', lat: 42.8765, lng: 74.6033, openTime: '07:00', closeTime: '22:00' },
        { name: 'Нан-Ай на Ахунбаева', address: 'ул. Ахунбаева, 98', lat: 42.8432, lng: 74.6085, openTime: '08:00', closeTime: '21:00' },
      ],
      templates: [
        {
          title: 'Пакет выпечки',
          category: 'BAKERY' as const,
          description: 'Хлеб, булочки, самса или круассаны — то, что осталось к вечеру',
          allergens: 'глютен, яйца, молоко',
          priceKgs: 150,
          valueKgs: 450,
          weightKg: 1.2,
          schedule: { quantity: 8, pickupFromTime: '20:00', pickupToTime: '21:30' },
        },
        {
          title: 'Сладкий бокс',
          category: 'DESSERTS' as const,
          description: 'Пирожные и торты дня',
          allergens: 'глютен, яйца, молоко, орехи',
          priceKgs: 250,
          valueKgs: 700,
          weightKg: 0.8,
          schedule: { quantity: 4, pickupFromTime: '20:30', pickupToTime: '21:30' },
        },
      ],
    },
    {
      ownerPhone: '+996700000003',
      ownerName: 'Айдана',
      brandName: 'Tóo Coffee',
      legalName: 'ИП Асанова А.',
      inn: '21234567890123',
      category: 'CAFE' as const,
      locations: [
        { name: 'Tóo Coffee Асанбай', address: 'мкр. Асанбай, 10/4', lat: 42.8155, lng: 74.6318, openTime: '08:00', closeTime: '23:00' },
      ],
      templates: [
        {
          title: 'Кофейный бокс',
          category: 'MIXED' as const,
          description: 'Сэндвичи, салаты и десерты из витрины',
          allergens: 'глютен, молоко',
          priceKgs: 200,
          valueKgs: 600,
          weightKg: 0.9,
          schedule: { quantity: 6, pickupFromTime: '21:00', pickupToTime: '22:30' },
        },
      ],
    },
    {
      ownerPhone: '+996700000004',
      ownerName: 'Бакыт',
      brandName: 'Ашкана №1',
      legalName: 'ОсОО «Ашкана Бир»',
      inn: '11234567890123',
      category: 'RESTAURANT' as const,
      locations: [
        { name: 'Ашкана №1 Центр', address: 'ул. Киевская, 77', lat: 42.8722, lng: 74.5886, openTime: '09:00', closeTime: '21:00' },
      ],
      templates: [
        {
          title: 'Обед дня',
          category: 'MEALS' as const,
          description: 'Плов, лагман или манты с салатом — 2 порции',
          allergens: 'глютен',
          priceKgs: 180,
          valueKgs: 520,
          weightKg: 1.0,
          schedule: { quantity: 10, pickupFromTime: '19:00', pickupToTime: '20:30' },
        },
      ],
    },
  ];

  for (const p of partners) {
    const existing = await prisma.user.findUnique({ where: { phone: p.ownerPhone } });
    if (existing?.partnerId) continue;
    const partner = await prisma.partner.create({
      data: {
        brandName: p.brandName,
        legalName: p.legalName,
        inn: p.inn,
        category: p.category,
        contactPhone: p.ownerPhone,
        bankName: 'MBank',
        bankAccount: '1234567890123456',
        status: 'ACTIVE',
        promoUntil: new Date(Date.now() + 90 * 86_400_000),
        locations: { create: p.locations },
      },
      include: { locations: true },
    });
    await prisma.user.upsert({
      where: { phone: p.ownerPhone },
      create: { phone: p.ownerPhone, name: p.ownerName, role: 'PARTNER_OWNER', partnerId: partner.id },
      update: { role: 'PARTNER_OWNER', partnerId: partner.id },
    });
    for (const t of p.templates) {
      const { schedule, ...data } = t;
      const template = await prisma.boxTemplate.create({ data: { ...data, partnerId: partner.id } });
      for (const location of partner.locations) {
        await prisma.schedule.create({
          data: { ...schedule, templateId: template.id, locationId: location.id, weekdays: everyDay },
        });
      }
    }
    if (p.ownerPhone === '+996700000002') {
      await prisma.user.upsert({
        where: { phone: '+996700000005' },
        create: {
          phone: '+996700000005',
          name: 'Эрмек (кассир)',
          role: 'PARTNER_STAFF',
          partnerId: partner.id,
          locationId: partner.locations[1].id,
        },
        update: {},
      });
    }
  }

  const created = await generateScheduledOffers();
  console.log(`Seed done. Offers created for today: ${created}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

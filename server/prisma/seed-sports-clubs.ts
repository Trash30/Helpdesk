import { prisma } from '../src/lib/prisma';

interface OrganisationData {
  name: string;
  clubs: string[];
}

const organisations: OrganisationData[] = [
  {
    name: 'LNR',
    clubs: [
      // Top 14
      'Stade Rochelais',
      'Union Bordeaux-Begles',
      'ASM Clermont',
      'LOU Rugby',
      'Aviron Bayonnais',
      'Section Paloise',
      'Montpellier Herault Rugby',
      'USA Perpignan',
      'US Montauban',
      'RC Toulon',
      'Castres Olympique',
      'Stade Toulousain',
      'Racing 92',
      'Stade Francais Paris',
      // Pro D2
      'FC Grenoble Rugby',
      'Valence Romans',
      'SU Agen',
      'RC Vannes',
      'Colomiers Rugby',
      'US Dax',
      'Oyonnax Rugby',
      'Biarritz Olympique PB',
      'Soyaux-Angouleme XV',
      'US Carcassonnaise',
      'Stade Montois Rugby',
      'Stade Aurillacois',
      'USON Nevers',
      'AS Beziers Herault',
      'CA Brive',
      'Provence Rugby',
    ],
  },
  {
    name: 'LNH',
    clubs: [
      'Aix',
      'Cesson-Rennes',
      'Chambery',
      'Chartres',
      'Dijon',
      'Dunkerque',
      'Istres',
      'Limoges',
      'Montpellier',
      'Nantes',
      'Nimes',
      'Paris',
      'Saint-Raphael',
      'Selestat',
      'Toulouse',
      'Tremblay',
    ],
  },
];

async function main(): Promise<void> {
  console.log('--- Seed Sports Clubs ---\n');

  for (const orgData of organisations) {
    // Upsert organisation
    const organisation = await prisma.clientOrganisation.upsert({
      where: { name: orgData.name },
      update: {},
      create: {
        name: orgData.name,
        isActive: true,
        position: 0,
      },
    });

    const orgCreated = organisation.createdAt.getTime() > Date.now() - 5000;
    console.log(
      `Organisation "${organisation.name}" ${orgCreated ? 'creee' : 'existante'} (id: ${organisation.id})`
    );

    // Upsert clubs
    for (const clubName of orgData.clubs) {
      const club = await prisma.clientClub.upsert({
        where: {
          name_organisationId: {
            name: clubName,
            organisationId: organisation.id,
          },
        },
        update: {},
        create: {
          name: clubName,
          organisationId: organisation.id,
          isActive: true,
          position: 0,
        },
      });

      const clubCreated = club.createdAt.getTime() > Date.now() - 5000;
      console.log(
        `  Club "${club.name}" ${clubCreated ? 'cree' : 'existant'}`
      );
    }

    console.log('');
  }

  console.log('--- Seed termine ---');
}

main()
  .catch((error: unknown) => {
    console.error('Erreur lors du seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

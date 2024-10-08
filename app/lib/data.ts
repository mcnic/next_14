import { unstable_noStore as noStore } from 'next/cache';

// import { sql } from '@vercel/postgres';
import prisma from '@/prisma/db';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  User,
  Revenue,
  LatestInvoice,
} from './definitions';
import { formatCurrency } from './utils';
import { InvoicesMobileSkeleton } from '../ui/skeletons';
import { Prisma } from '@prisma/client';

export async function fetchRevenue() {
  // Add noStore() here to prevent the response from being cached.
  // This is equivalent to in fetch(..., {cache: 'no-store'}).
  noStore();

  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    console.log('Fetching revenue data...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await prisma.revenue.findMany();

    console.log('Data fetch completed after 3 seconds.');

    return data;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  noStore();

  try {
    const data = await prisma.invoice.findMany({
      select: {
        id: true,
        amount: true,
        Customer: {
          select: {
            name: true,
            image_url: true,
            email: true,
          },
        },
      },
      relationLoadStrategy: 'join',
      orderBy: [{ date: 'desc' }],
      take: 5,
    });

    const latestInvoices = data.map(({ id, amount, Customer }) => ({
      id,
      amount: formatCurrency(amount),
      name: Customer.name,
      image_url: Customer.image_url,
      email: Customer.email,
    }));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  noStore();

  try {
    // const query = Prisma.raw(`SELECT
    //    SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END) AS "paid",
    //    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
    //    FROM invoices`);

    const data = await Promise.all([
      prisma.invoice.count(),
      prisma.customer.count(),
      prisma.invoice.findMany({
        where: {
          status: 'PAID',
        },
      }),
      prisma.invoice.findMany({
        where: {
          status: 'PENDING',
        },
      }),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      numberOfCustomers: Number(data[0] ?? '0'),
      numberOfInvoices: Number(data[1] ?? '0'),
      totalPaidInvoices: formatCurrency(data[2].length ?? '0'),
      totalPendingInvoices: formatCurrency(data[3].length ?? '0'),
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const getSearchResult = async (query: string, offset: number, take: number) =>
  await prisma.invoice.findMany({
    select: {
      id: true,
      amount: true,
      date: true,
      status: true,
      Customer: {
        select: {
          name: true,
          image_url: true,
          email: true,
        },
      },
    },
    where: {
      OR: [
        {
          date: {
            contains: query,
          },
        },
        {
          Customer: {
            name: {
              contains: query,
            },
          },
        },
        {
          Customer: {
            email: {
              contains: query,
            },
          },
        },
      ],
    },
    relationLoadStrategy: 'join',
    orderBy: [{ date: 'desc' }],
    skip: offset,
    take,
  });

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // const invoices = await sql<InvoicesTable>`
    //   SELECT
    //     invoices.id,
    //     invoices.amount,
    //     invoices.date,
    //     invoices.status,
    //     customers.name,
    //     customers.email,
    //     customers.image_url
    //   FROM invoices
    //   JOIN customers ON invoices.customer_id = customers.id
    //   WHERE
    //     customers.name ILIKE ${`%${query}%`} OR
    //     customers.email ILIKE ${`%${query}%`} OR
    //     invoices.amount::text ILIKE ${`%${query}%`} OR
    //     invoices.date::text ILIKE ${`%${query}%`} OR
    //     invoices.status ILIKE ${`%${query}%`}
    //   ORDER BY invoices.date DESC
    //   LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    // `;

    // return invoices.rows;

    const data = await getSearchResult(query, offset, ITEMS_PER_PAGE);

    const latestInvoices = data.map(
      ({ id, amount, date, status, Customer }) => ({
        id,
        amount,
        date,
        status,
        name: Customer.name,
        image_url: Customer.image_url,
        email: Customer.email,
      }),
    );

    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await getSearchResult(query, 0, 10000000);

    const totalPages = Math.ceil(Number(data.length) / ITEMS_PER_PAGE);
    
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

// export async function fetchInvoiceById(id: string) {
//   try {
//     const data = await sql<InvoiceForm>`
//       SELECT
//         invoices.id,
//         invoices.customer_id,
//         invoices.amount,
//         invoices.status
//       FROM invoices
//       WHERE invoices.id = ${id};
//     `;

//     const invoice = data.rows.map((invoice) => ({
//       ...invoice,
//       // Convert amount from cents to dollars
//       amount: invoice.amount / 100,
//     }));

//     return invoice[0];
//   } catch (error) {
//     console.error('Database Error:', error);
//     throw new Error('Failed to fetch invoice.');
//   }
// }

// export async function fetchCustomers() {
//   try {
//     const data = await sql<CustomerField>`
//       SELECT
//         id,
//         name
//       FROM customers
//       ORDER BY name ASC
//     `;

//     const customers = data.rows;
//     return customers;
//   } catch (err) {
//     console.error('Database Error:', err);
//     throw new Error('Failed to fetch all customers.');
//   }
// }

// export async function fetchFilteredCustomers(query: string) {
//   try {
//     const data = await sql<CustomersTableType>`
// 		SELECT
// 		  customers.id,
// 		  customers.name,
// 		  customers.email,
// 		  customers.image_url,
// 		  COUNT(invoices.id) AS total_invoices,
// 		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
// 		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
// 		FROM customers
// 		LEFT JOIN invoices ON customers.id = invoices.customer_id
// 		WHERE
// 		  customers.name ILIKE ${`%${query}%`} OR
//         customers.email ILIKE ${`%${query}%`}
// 		GROUP BY customers.id, customers.name, customers.email, customers.image_url
// 		ORDER BY customers.name ASC
// 	  `;

//     const customers = data.rows.map((customer) => ({
//       ...customer,
//       total_pending: formatCurrency(customer.total_pending),
//       total_paid: formatCurrency(customer.total_paid),
//     }));

//     return customers;
//   } catch (err) {
//     console.error('Database Error:', err);
//     throw new Error('Failed to fetch customer table.');
//   }
// }

// export async function getUser(email: string) {
//   try {
//     const user = await sql`SELECT * FROM users WHERE email=${email}`;
//     return user.rows[0] as User;
//   } catch (error) {
//     console.error('Failed to fetch user:', error);
//     throw new Error('Failed to fetch user.');
//   }
// }

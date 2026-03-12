import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects } from "../db/schema";
import { db } from "../db";

const subjectsRouter = express.Router();

subjectsRouter.get("/", async (req, res) => {
    try {
        const { search, department, page = "1", limit = "10" } = req.query;

        
        const pageParam = Array.isArray(page) ? page[0] : page;
        const limitParam = Array.isArray(limit) ? limit[0] : limit;
        const currentPage = Number(pageParam);
        const limitPerPage = Number(limitParam);

        if (
            !Number.isInteger(currentPage) || currentPage < 1 ||
            !Number.isInteger(limitPerPage) || limitPerPage < 1
        ) {
            return res.status(400).json({ message: "page and limit must be positive integers" });
        }

        const offset = (currentPage -1) * limitPerPage;

        const filterConditions = [];

        if (search){
            filterConditions.push(
                or(
                    ilike(subjects.code, `%${search}%`),
                    ilike(subjects.name, `%${search}%`)
                )
            )
        }

        if (department) {
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`; //escaping
            filterConditions.push(ilike(departments.name, deptPattern));
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;
        const countResult = await db
            .select({ count: sql<number>`count(*)`.mapWith(Number) })
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0; // optional chaining & nullish coalescing operator

        const subjectList = await db
            .select({
                ...getTableColumns(subjects),
                department: { ...getTableColumns(departments)}
            }).from(subjects).leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(subjects.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: subjectList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage)
            }
        })
    } catch (error) {
        console.log(`GET /subjects error ${error}`);
        return res.status(500).json({ message: "Internal server error" });
    }
})

export default subjectsRouter
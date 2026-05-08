import { Router } from "express"
import authController from "../controllers/authController"
import { adminMiddleware, userIdParamMiddleware } from "../middlewares/middlewares"
import userController from "../controllers/userController"

const router = Router()

router.post('/login', authController.login)
router.post('/logout', authController.logout)
router.post('/refresh', authController.refresh)

router.get('/users', adminMiddleware, userController.getUsers)
router.get('/users/:id', userIdParamMiddleware, userController.getUserById)
router.post('/users', userController.createUser)
router.put('/block-user/:id', userIdParamMiddleware, userController.blockUser)


export default router

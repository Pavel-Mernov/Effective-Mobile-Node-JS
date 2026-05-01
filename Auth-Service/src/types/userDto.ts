export interface UserDto {
    id: string;

    username: string;
    email: string;
    password: string;

    isActive ?: boolean;
    birthDate ?: string;
}

export type CreateUserDto = Omit<UserDto, 'id'>;
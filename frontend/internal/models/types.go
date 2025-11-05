package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type Product struct {
	ID          primitive.ObjectID `bson:"_id"`
	Name        string             `bson:"name"`
	Price       int                `bson:"price"`
	Description string             `bson:"description"`
	ImagePath   string             `bson:"image_path"`
}

type Item struct {
	ProductID primitive.ObjectID `bson:"product_id,omitempty"`
	Name      string             `bson:"name"`
	Qty       int                `bson:"qty"`
	UnitPrice int                `bson:"unit_price"`
	Subtotal  int                `bson:"subtotal"`
}

type Order struct {
	ID        primitive.ObjectID `bson:"_id"`
	BuyerName string             `bson:"buyer_name"`
	Address   string             `bson:"address"`
	Email     string             `bson:"email"`
	Status    string             `bson:"status"`
	Items     []Item             `bson:"items"`
	Total     int                `bson:"total"`
}
